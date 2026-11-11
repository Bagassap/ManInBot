import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Injectable } from '@nestjs/common';
import { dataDir, writePrivate } from '../runtime/bootstrap.js';

interface StoredSettings {
  accountToken?: string;
}

/** Alamat gateway MiB: kunci layanan AI hanya ada di server MiB, aplikasi memakai kode lisensi. */
export const GATEWAY_URL = process.env.MIB_GATEWAY_URL || 'https://maninbot.id/ai';

/**
 * Pengaturan yang diubah lewat aplikasi (token sesi akun MiB). Disimpan di folder data pengguna, di luar database.
 * Tanpa folder data (mode pengembangan) dipakai ANTHROPIC_API_KEY langsung ke layanan AI.
 */
@Injectable()
export class SettingsService {
  private readonly file = dataDir() ? path.join(dataDir()!, 'settings.json') : null;

  private read(): StoredSettings {
    if (!this.file || !existsSync(this.file)) return {};
    try {
      return JSON.parse(readFileSync(this.file, 'utf8')) as StoredSettings;
    } catch {
      return {};
    }
  }

  get accountToken(): string | null {
    return this.read().accountToken || null;
  }

  /** Kredensial untuk klien AI: token akun MiB (lewat gateway) menang atas kunci langsung milik pengembang. */
  get credentials(): { apiKey: string; baseURL?: string } | null {
    const token = this.accountToken;
    if (token) return { apiKey: token, baseURL: GATEWAY_URL };
    const dev = process.env.ANTHROPIC_API_KEY;
    return dev ? { apiKey: dev } : null;
  }

  get canPersist() {
    return this.file !== null;
  }

  setAccountToken(token: string | null) {
    if (!this.file) throw new Error('Folder data tidak diatur (mode pengembangan)');
    const s = this.read();
    if (token) s.accountToken = token;
    else delete s.accountToken;
    writePrivate(this.file, JSON.stringify(s));
  }
}
