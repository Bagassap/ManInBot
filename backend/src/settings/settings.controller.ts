import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Put, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsString, Matches, MaxLength } from 'class-validator';
import { AdminGuard } from '../admin/admin.guard.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { GATEWAY_URL, SettingsService } from './settings.service.js';

class LicenseDto {
  @IsString()
  @MaxLength(60)
  @Matches(/^MIB-[0-9A-Fa-f]{6}-[0-9A-Fa-f]{6}-[0-9A-Fa-f]{6}$/, { message: 'Format kode tidak dikenali. Contoh: MIB-1A2B3C-4D5E6F-7A8B9C' })
  code!: string;
}

export interface LicenseInfo {
  quotaTokens: number;
  usedTokens: number;
  expiresAt: string | null;
}

type Check = { state: 'ok'; info: LicenseInfo } | { state: 'rejected'; message: string } | { state: 'offline' };

/** Menanyakan kuota ke gateway MiB. `rejected` hanya bila gateway menjawab bahwa kode tidak sah. */
async function checkLicense(code: string): Promise<Check> {
  try {
    const r = await fetch(`${GATEWAY_URL}/v1/license`, { headers: { 'x-api-key': code }, signal: AbortSignal.timeout(8000) });
    const body = (await r.json().catch(() => null)) as { error?: { message?: string } } & Partial<LicenseInfo> | null;
    if (r.ok && body) return { state: 'ok', info: { quotaTokens: body.quotaTokens ?? 0, usedTokens: body.usedTokens ?? 0, expiresAt: body.expiresAt ?? null } };
    if (r.status >= 400 && r.status < 500) return { state: 'rejected', message: body?.error?.message ?? 'Kode lisensi ditolak.' };
  } catch {
    // tidak ada internet / server tidak terjangkau
  }
  return { state: 'offline' };
}

@Controller('settings')
@UseGuards(AuthGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  async status() {
    const code = this.settings.licenseCode;
    const check = code ? await checkLicense(code) : null;
    return {
      agentReady: this.settings.credentials !== null,
      keyHint: this.settings.keyHint,
      canSaveKey: this.settings.canPersist,
      license: check?.state === 'ok' ? check.info : null,
      licenseProblem: check?.state === 'rejected' ? check.message : null,
    };
  }

  /** Menyimpan kode lisensi MiB. Hanya admin; kode diperiksa ke server MiB sebelum disimpan. */
  @Put('license')
  @UseGuards(AdminGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async setLicense(@Body() dto: LicenseDto) {
    if (!this.settings.canPersist) throw new BadRequestException('Penyimpanan kode hanya tersedia pada aplikasi terpasang.');
    const code = dto.code.toUpperCase();
    const check = await checkLicense(code);
    if (check.state === 'rejected') throw new BadRequestException(check.message);
    this.settings.setLicenseCode(code); // offline: simpan saja, akan terbukti saat dipakai
    return { saved: true, verified: check.state === 'ok', keyHint: this.settings.keyHint, license: check.state === 'ok' ? check.info : null };
  }

  @Delete('license')
  @HttpCode(204)
  @UseGuards(AdminGuard)
  clearLicense() {
    this.settings.setLicenseCode(null);
  }
}
