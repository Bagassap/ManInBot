import { Body, Controller, Delete, Get, HttpCode, HttpException, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';
import { AdminGuard } from '../admin/admin.guard.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { GATEWAY_URL, SettingsService } from './settings.service.js';

class CredsDto {
  @IsEmail()
  @MaxLength(120)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password!: string;
}
class VerifyDto {
  @IsEmail()
  @MaxLength(120)
  email!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}
class ForgotDto {
  @IsEmail()
  @MaxLength(120)
  email!: string;
}
class ResetDto extends VerifyDto {
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password!: string;
}
class OptionalDto {
  @IsOptional()
  @IsString()
  _?: string;
}

export interface AccountView {
  email: string;
  paid: boolean;
  paidUntil: string | null;
  usedToday: number;
  limitToday: number;
  plan: PlanView;
}
export interface PlanView {
  freePerDay: number;
  paidPerDay: number;
  days: number;
  priceIdr: number;
  canPay: boolean;
}

interface GwResult<T> {
  status: number;
  body: T & { error?: string; needVerify?: boolean };
}

/** Memanggil gateway MiB. Galat jaringan menjadi 503; galat dari gateway diteruskan apa adanya (pesannya sudah berbahasa Indonesia). */
async function gw<T = Record<string, unknown>>(path: string, opts: { method?: string; body?: unknown; token?: string | null } = {}): Promise<GwResult<T>> {
  try {
    const r = await fetch(`${GATEWAY_URL}${path}`, {
      method: opts.method ?? (opts.body ? 'POST' : 'GET'),
      headers: { 'Content-Type': 'application/json', ...(opts.token ? { 'x-api-key': opts.token } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    return { status: r.status, body: ((await r.json().catch(() => ({}))) as GwResult<T>['body']) ?? {} };
  } catch {
    throw new HttpException('Tidak bisa terhubung ke server MiB. Periksa koneksi internet Anda.', 503);
  }
}
function ok<T>(r: GwResult<T>): GwResult<T>['body'] {
  if (r.status >= 200 && r.status < 300) return r.body;
  throw new HttpException({ message: r.body.error ?? 'Permintaan ditolak.', needVerify: r.body.needVerify === true }, r.status);
}

@Controller('settings')
@UseGuards(AuthGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** Status akun MiB dari gateway. Sesi yang sudah berakhir dibersihkan agar pengguna diminta masuk lagi. */
  @Get()
  async status() {
    const token = this.settings.accountToken;
    let account: AccountView | null = null;
    let problem: string | null = null;
    if (token) {
      try {
        const r = await gw<AccountView>('/v1/account', { token });
        if (r.status === 200) account = r.body as AccountView;
        else if (r.status === 401) this.settings.setAccountToken(null);
        else problem = r.body.error ?? null;
      } catch {
        problem = 'Tidak bisa terhubung ke server MiB untuk memeriksa akun.';
      }
    }
    let plan: PlanView | null = account?.plan ?? null;
    if (!plan) plan = await gw<PlanView>('/v1/plan').then((r) => (r.status === 200 ? (r.body as PlanView) : null)).catch(() => null);
    return {
      agentReady: this.settings.credentials !== null,
      canSaveKey: this.settings.canPersist,
      loggedIn: this.settings.accountToken !== null,
      account,
      accountProblem: problem,
      plan,
    };
  }

  @Post('account/register')
  @UseGuards(AdminGuard)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async register(@Body() dto: CredsDto) {
    return ok(await gw('/v1/account/register', { body: dto }));
  }

  @Post('account/verify')
  @UseGuards(AdminGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async verify(@Body() dto: VerifyDto) {
    const b = ok(await gw<{ token: string }>('/v1/account/verify', { body: dto }));
    this.settings.setAccountToken(b.token as string);
    return { ok: true };
  }

  @Post('account/login')
  @UseGuards(AdminGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(@Body() dto: CredsDto) {
    const b = ok(await gw<{ token: string }>('/v1/account/login', { body: dto }));
    this.settings.setAccountToken(b.token as string);
    return { ok: true };
  }

  @Post('account/forgot')
  @UseGuards(AdminGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async forgot(@Body() dto: ForgotDto) {
    return ok(await gw('/v1/account/forgot', { body: dto }));
  }

  @Post('account/reset')
  @UseGuards(AdminGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async reset(@Body() dto: ResetDto) {
    return ok(await gw('/v1/account/reset', { body: dto }));
  }

  /** Membuat pembayaran paket berbayar; mengembalikan alamat halaman bayar yang dibuka pengguna di browser. */
  @Post('account/checkout')
  @UseGuards(AdminGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async checkout(@Body() _dto: OptionalDto) {
    const token = this.settings.accountToken;
    if (!token) throw new HttpException('Masuk ke akun MiB terlebih dahulu.', 401);
    const b = ok(await gw<{ url: string }>('/v1/account/checkout', { method: 'POST', body: {}, token }));
    return { url: b.url as string };
  }

  @Delete('account')
  @HttpCode(204)
  @UseGuards(AdminGuard)
  async logout() {
    const token = this.settings.accountToken;
    if (token) await gw('/v1/account/logout', { method: 'POST', body: {}, token }).catch(() => undefined);
    this.settings.setAccountToken(null);
  }
}
