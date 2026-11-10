import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string | null;
  picture: string | null;
}

const TIMEOUT_MS = 10_000;

/** Alur OAuth 2.0 "authorization code" Google. Endpoint bisa diganti lewat env (untuk pengujian). */
@Injectable()
export class GoogleService {
  private readonly logger = new Logger(GoogleService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly authUrl: string;
  private readonly tokenUrl: string;
  private readonly userInfoUrl: string;

  constructor(config: ConfigService) {
    this.clientId = config.get<string>('GOOGLE_CLIENT_ID') ?? '';
    this.clientSecret = config.get<string>('GOOGLE_CLIENT_SECRET') ?? '';
    this.redirectUri =
      config.get<string>('GOOGLE_REDIRECT_URI') ||
      `http://localhost:${config.get<string>('PORT') ?? 4000}/auth/google/callback`;
    this.authUrl = config.get<string>('GOOGLE_AUTH_URL') || 'https://accounts.google.com/o/oauth2/v2/auth';
    this.tokenUrl = config.get<string>('GOOGLE_TOKEN_URL') || 'https://oauth2.googleapis.com/token';
    this.userInfoUrl = config.get<string>('GOOGLE_USERINFO_URL') || 'https://openidconnect.googleapis.com/v1/userinfo';
  }

  get enabled() {
    return Boolean(this.clientId && this.clientSecret);
  }

  /** URL tujuan pengalihan ke halaman persetujuan Google, beserta `state` anti-CSRF. */
  buildAuthUrl(): { url: string; state: string } | null {
    if (!this.enabled) return null;
    const state = randomBytes(24).toString('base64url');
    const url = new URL(this.authUrl);
    url.search = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    }).toString();
    return { url: url.toString(), state };
  }

  /** Menukar `code` dengan token, lalu mengambil profil. Hanya email terverifikasi yang diterima. */
  async fetchProfile(code: string): Promise<GoogleProfile> {
    const tokenRes = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!tokenRes.ok) throw new Error(`Penukaran kode Google gagal (${tokenRes.status})`);
    const { access_token: accessToken } = (await tokenRes.json()) as { access_token?: string };
    if (!accessToken) throw new Error('Google tidak mengembalikan access token');

    const infoRes = await fetch(this.userInfoUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!infoRes.ok) throw new Error(`Gagal mengambil profil Google (${infoRes.status})`);
    const info = (await infoRes.json()) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    };

    if (!info.sub || !info.email) throw new Error('Profil Google tidak lengkap');
    if (info.email_verified !== true) {
      this.logger.warn('Login Google ditolak: email belum terverifikasi');
      throw new Error('Email Google belum terverifikasi');
    }
    return {
      sub: info.sub,
      email: info.email.trim().toLowerCase(),
      name: info.name?.trim() || null,
      picture: info.picture ?? null,
    };
  }
}
