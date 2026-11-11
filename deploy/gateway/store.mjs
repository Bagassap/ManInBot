// Penyimpanan lisensi berupa satu berkas JSON (ditulis atomik). Kode asli tidak disimpan, hanya hash SHA-256-nya.
// Server dan CLI memakai berkas yang sama: setiap tulis membaca ulang berkas lalu menerapkan perubahan, sehingga
// kode yang dibuat/dicabut lewat CLI langsung terlihat server dan pemakaian dari server tidak menimpa perubahan CLI.
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const hashCode = (code) => createHash('sha256').update(code).digest('hex');

export class LicenseStore {
  constructor(dir) {
    this.file = path.join(dir, 'licenses.json');
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    this.cache = {};
    this.mtime = 0;
    this.pending = new Map(); // hash -> token yang belum ditulis
    this.timer = setInterval(() => this.flush(), 2000);
    this.timer.unref?.();
  }

  load() {
    if (!existsSync(this.file)) return (this.cache = {});
    const m = statSync(this.file).mtimeMs;
    if (m !== this.mtime) {
      this.cache = JSON.parse(readFileSync(this.file, 'utf8'));
      this.mtime = m;
    }
    return this.cache;
  }

  write(data) {
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
    renameSync(tmp, this.file);
    this.cache = data;
    this.mtime = statSync(this.file).mtimeMs;
  }

  flush() {
    if (this.pending.size === 0) return;
    const data = JSON.parse(existsSync(this.file) ? readFileSync(this.file, 'utf8') : '{}');
    for (const [h, n] of this.pending) if (data[h]) data[h].usedTokens += n;
    this.pending.clear();
    this.write(data);
  }

  /** Lisensi beserta pemakaian yang belum ditulis, supaya kuota akurat di antara dua penulisan. */
  get(h) {
    const l = this.load()[h];
    return l ? { ...l, usedTokens: l.usedTokens + (this.pending.get(h) || 0) } : null;
  }

  addUsage(h, tokens) {
    this.pending.set(h, (this.pending.get(h) || 0) + tokens);
  }

  // --- dipakai CLI ---
  mutate(fn) {
    this.flush();
    const data = existsSync(this.file) ? JSON.parse(readFileSync(this.file, 'utf8')) : {};
    const r = fn(data);
    this.write(data);
    return r;
  }

  create({ quotaTokens, days, note }) {
    const seg = () => randomBytes(3).toString('hex').toUpperCase();
    const code = `MIB-${seg()}-${seg()}-${seg()}`;
    this.mutate((d) => {
      d[hashCode(code)] = {
        note: note || '',
        quotaTokens,
        usedTokens: 0,
        createdAt: new Date().toISOString(),
        expiresAt: days ? new Date(Date.now() + days * 86_400_000).toISOString() : null,
        revoked: false,
      };
    });
    return code;
  }

  list() {
    return Object.entries(this.load()).map(([h, l]) => ({ id: h.slice(0, 8), ...l }));
  }

  /** Cari lewat awalan id (8 hex dari `list`) atau kode lengkap. */
  setRevoked(idOrCode, revoked) {
    return this.mutate((d) => {
      const h = d[hashCode(idOrCode)] ? hashCode(idOrCode) : Object.keys(d).find((k) => k.startsWith(idOrCode.toLowerCase()));
      if (!h || idOrCode.length < 6) return false;
      d[h].revoked = revoked;
      return true;
    });
  }
}
