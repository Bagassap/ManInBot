// Database gateway MiB (SQLite bawaan Node). Satu proses menulis; semua operasi bersifat sinkron sehingga atomik.
import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const sha = (s) => createHash('sha256').update(s).digest('hex');

/** Tanggal (YYYY-MM-DD) menurut WIB; batas harian kuota berganti pukul 00.00 WIB. */
export const dayKey = (t = Date.now()) => new Date(t + 7 * 3600_000).toISOString().slice(0, 10);

function hashPassword(pw) {
  const salt = randomBytes(16);
  return `s1$${salt.toString('hex')}$${scryptSync(pw, salt, 32).toString('hex')}`;
}
function checkPassword(pw, stored) {
  const [v, salt, hash] = String(stored).split('$');
  if (v !== 's1') return false;
  const a = scryptSync(pw, Buffer.from(salt, 'hex'), 32);
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export class Db {
  constructor(dir) {
    if (dir !== ':memory:') mkdirSync(dir, { recursive: true, mode: 0o700 });
    this.db = dir === ':memory:' ? new DatabaseSync(':memory:') : new DatabaseSync(path.join(dir, 'gateway.db'));
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, pass_hash TEXT NOT NULL,
        verified INTEGER NOT NULL DEFAULT 0, banned INTEGER NOT NULL DEFAULT 0,
        paid_until INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS email_codes (
        email TEXT NOT NULL, purpose TEXT NOT NULL, code_hash TEXT NOT NULL, expires INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (email, purpose));
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS commands (
        user_id INTEGER NOT NULL, cmd_id TEXT NOT NULL, day TEXT NOT NULL, tokens INTEGER NOT NULL DEFAULT 0,
        created INTEGER NOT NULL, PRIMARY KEY (user_id, cmd_id));
      CREATE INDEX IF NOT EXISTS commands_day ON commands (user_id, day);
      CREATE TABLE IF NOT EXISTS payments (
        order_id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, amount INTEGER NOT NULL, days INTEGER NOT NULL,
        status TEXT NOT NULL, created INTEGER NOT NULL, paid_at INTEGER);
    `);
  }

  q(sql) {
    return this.db.prepare(sql);
  }

  // --- pengguna ---
  userByEmail(email) {
    return this.q('SELECT * FROM users WHERE email = ?').get(email) ?? null;
  }
  userById(id) {
    return this.q('SELECT * FROM users WHERE id = ?').get(id) ?? null;
  }
  /** Membuat akun baru atau memperbarui kata sandi akun yang belum terverifikasi. */
  upsertUnverified(email, password) {
    const u = this.userByEmail(email);
    if (u) {
      this.q('UPDATE users SET pass_hash = ? WHERE id = ?').run(hashPassword(password), u.id);
      return u.id;
    }
    return Number(this.q('INSERT INTO users (email, pass_hash, created_at) VALUES (?, ?, ?)').run(email, hashPassword(password), Date.now()).lastInsertRowid);
  }
  verifyPassword(user, password) {
    return checkPassword(password, user.pass_hash);
  }
  setPassword(id, password) {
    this.q('UPDATE users SET pass_hash = ?, verified = 1 WHERE id = ?').run(hashPassword(password), id);
    this.q('DELETE FROM sessions WHERE user_id = ?').run(id);
  }
  setBanned(email, banned) {
    return Number(this.q('UPDATE users SET banned = ? WHERE email = ?').run(banned ? 1 : 0, email).changes) > 0;
  }
  /** Menambah hari berbayar; bila masih aktif, hari ditambahkan di belakang masa berlaku yang ada. */
  extendPaid(userId, days) {
    const u = this.userById(userId);
    const base = Math.max(Date.now(), u?.paid_until ?? 0);
    const until = base + days * 86_400_000;
    this.q('UPDATE users SET paid_until = ? WHERE id = ?').run(until, userId);
    return until;
  }
  listUsers() {
    return this.q('SELECT id, email, verified, banned, paid_until, created_at FROM users ORDER BY id').all();
  }

  // --- kode email (verifikasi / reset) ---
  newCode(email, purpose) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    this.q('INSERT OR REPLACE INTO email_codes (email, purpose, code_hash, expires, attempts) VALUES (?, ?, ?, ?, 0)').run(email, purpose, sha(`${email}|${purpose}|${code}`), Date.now() + 15 * 60_000);
    return code;
  }
  /** true bila kode benar; kode hangus setelah dipakai atau setelah 5 salah. */
  consumeCode(email, purpose, code) {
    const row = this.q('SELECT * FROM email_codes WHERE email = ? AND purpose = ?').get(email, purpose);
    if (!row || row.expires < Date.now() || row.attempts >= 5) return false;
    if (row.code_hash !== sha(`${email}|${purpose}|${String(code).trim()}`)) {
      this.q('UPDATE email_codes SET attempts = attempts + 1 WHERE email = ? AND purpose = ?').run(email, purpose);
      return false;
    }
    this.q('DELETE FROM email_codes WHERE email = ? AND purpose = ?').run(email, purpose);
    return true;
  }
  markVerified(id) {
    this.q('UPDATE users SET verified = 1 WHERE id = ?').run(id);
  }

  // --- sesi ---
  newSession(userId, days = 90) {
    const token = `mibs_${randomBytes(24).toString('hex')}`;
    this.q('INSERT INTO sessions (token_hash, user_id, expires) VALUES (?, ?, ?)').run(sha(token), userId, Date.now() + days * 86_400_000);
    return token;
  }
  userBySession(token) {
    const s = this.q('SELECT user_id, expires FROM sessions WHERE token_hash = ?').get(sha(token));
    if (!s || s.expires < Date.now()) return null;
    return this.userById(s.user_id);
  }
  endSession(token) {
    this.q('DELETE FROM sessions WHERE token_hash = ?').run(sha(token));
  }
  purge() {
    const now = Date.now();
    this.q('DELETE FROM sessions WHERE expires < ?').run(now);
    this.q('DELETE FROM email_codes WHERE expires < ?').run(now);
    this.q('DELETE FROM commands WHERE created < ?').run(now - 40 * 86_400_000);
  }

  // --- kuota perintah ---
  usedToday(userId) {
    return this.q('SELECT COUNT(*) AS n FROM commands WHERE user_id = ? AND day = ?').get(userId, dayKey()).n;
  }
  /**
   * Mencatat awal satu perintah (satu pesan pengguna ke agen; terdiri dari banyak panggilan ke layanan AI).
   * Mengembalikan { ok, tokens } atau { ok:false, reason } bila kuota harian habis / perintah ini sudah melewati batas token.
   */
  beginCommand(userId, cmdId, perDay, cmdTokenCap) {
    const day = dayKey();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const row = this.q('SELECT day, tokens FROM commands WHERE user_id = ? AND cmd_id = ?').get(userId, cmdId);
      let r;
      if (row) {
        r = row.tokens >= cmdTokenCap ? { ok: false, reason: 'cmd_cap' } : { ok: true, tokens: row.tokens };
      } else if (this.usedToday(userId) >= perDay) {
        r = { ok: false, reason: 'daily' };
      } else {
        this.q('INSERT INTO commands (user_id, cmd_id, day, tokens, created) VALUES (?, ?, ?, 0, ?)').run(userId, cmdId, day, Date.now());
        r = { ok: true, tokens: 0 };
      }
      this.db.exec('COMMIT');
      return r;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  addTokens(userId, cmdId, tokens) {
    this.q('UPDATE commands SET tokens = tokens + ? WHERE user_id = ? AND cmd_id = ?').run(tokens, userId, cmdId);
  }

  // --- pembayaran ---
  createPayment(orderId, userId, amount, days) {
    this.q('INSERT INTO payments (order_id, user_id, amount, days, status, created) VALUES (?, ?, ?, ?, ?, ?)').run(orderId, userId, amount, days, 'pending', Date.now());
  }
  payment(orderId) {
    return this.q('SELECT * FROM payments WHERE order_id = ?').get(orderId) ?? null;
  }
  /** Menandai lunas tepat sekali; mengembalikan masa berlaku baru atau null bila sudah pernah diproses. */
  settle(orderId) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const p = this.payment(orderId);
      if (!p || p.status !== 'pending') {
        this.db.exec('COMMIT');
        return null;
      }
      this.q('UPDATE payments SET status = ?, paid_at = ? WHERE order_id = ?').run('paid', Date.now(), orderId);
      const until = this.extendPaid(p.user_id, p.days);
      this.db.exec('COMMIT');
      return until;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  failPayment(orderId, status) {
    this.q("UPDATE payments SET status = ? WHERE order_id = ? AND status = 'pending'").run(status, orderId);
  }
}
