import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Injectable } from '@nestjs/common';
import { dataDir, writePrivate } from '../runtime/bootstrap.js';

export interface CachedAccount {
  email: string;
  name: string | null;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
  profileComplete: boolean;
}

interface StoredSettings {
  accountToken?: string;
  account?: CachedAccount;
}

export const GATEWAY_URL = process.env.MIB_GATEWAY_URL || 'https://maninbot.id/ai';

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

  get credentials(): { apiKey: string; baseURL?: string } | null {
    const token = this.accountToken;
    if (token) return { apiKey: token, baseURL: GATEWAY_URL };
    const dev = process.env.ANTHROPIC_API_KEY;
    return dev ? { apiKey: dev } : null;
  }

  get cachedAccount(): CachedAccount | null {
    return this.accountToken ? (this.read().account ?? null) : null;
  }

  setCachedAccount(a: CachedAccount) {
    if (!this.file) return;
    const s = this.read();
    s.account = { email: a.email, name: a.name ?? null, phone: a.phone ?? null, company: a.company ?? null, jobTitle: a.jobTitle ?? null, profileComplete: !!a.profileComplete };
    writePrivate(this.file, JSON.stringify(s));
  }

  get accountReady() {
    return !this.file || this.cachedAccount?.profileComplete === true;
  }

  get canPersist() {
    return this.file !== null;
  }

  setAccountToken(token: string | null) {
    if (!this.file) throw new Error('Folder data tidak diatur (mode pengembangan)');
    const s = this.read();
    if (token) s.accountToken = token;
    else {
      delete s.accountToken;
      delete s.account;
    }
    writePrivate(this.file, JSON.stringify(s));
  }
}
