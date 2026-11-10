import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Injectable } from '@nestjs/common';
import { dataDir, writePrivate } from '../runtime/bootstrap.js';

interface StoredSettings {
  anthropicKey?: string;
}

/**
 * Pengaturan yang diubah lewat aplikasi (kunci API Claude milik pemakai). Disimpan di folder data pengguna,
 * di luar database, supaya cadangan/ekspor database tidak ikut membawa kunci. Tanpa folder data (mode
 * pengembangan) kunci hanya dibaca dari ANTHROPIC_API_KEY.
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

  /** Kunci yang tersimpan di aplikasi menang atas variabel lingkungan. */
  get anthropicKey(): string | null {
    return this.read().anthropicKey || process.env.ANTHROPIC_API_KEY || null;
  }

  get canPersist() {
    return this.file !== null;
  }

  setAnthropicKey(key: string | null) {
    if (!this.file) throw new Error('Folder data tidak diatur; isi ANTHROPIC_API_KEY di .env');
    const s = this.read();
    if (key) s.anthropicKey = key;
    else delete s.anthropicKey;
    writePrivate(this.file, JSON.stringify(s));
  }

  /** Petunjuk aman untuk ditampilkan: empat karakter terakhir saja. */
  get keyHint(): string | null {
    const k = this.anthropicKey;
    return k ? `…${k.slice(-4)}` : null;
  }
}
