import Anthropic from '@anthropic-ai/sdk';
import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Put, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsString, Matches, MaxLength } from 'class-validator';
import { AdminGuard } from '../admin/admin.guard.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { SettingsService } from './settings.service.js';

class KeyDto {
  @IsString()
  @MaxLength(300)
  @Matches(/^sk-ant-[A-Za-z0-9_-]{20,}$/, { message: 'Format kunci tidak dikenali. Periksa kembali kunci Anda.' })
  key!: string;
}

@Controller('settings')
@UseGuards(AuthGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  status() {
    return {
      agentReady: this.settings.anthropicKey !== null,
      keyHint: this.settings.keyHint,
      canSaveKey: this.settings.canPersist,
      model: process.env.ANTHROPIC_MODEL || 'claude-opus-5-5',
    };
  }

  /** Menyimpan kunci API Claude milik pemakai. Hanya admin; kunci diperiksa ke Anthropic sebelum disimpan. */
  @Put('anthropic-key')
  @UseGuards(AdminGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async setKey(@Body() dto: KeyDto) {
    if (!this.settings.canPersist) {
      throw new BadRequestException('Penyimpanan kunci hanya tersedia pada aplikasi terpasang. Isi ANTHROPIC_API_KEY di .env server.');
    }
    let verified = true;
    try {
      await new Anthropic({ apiKey: dto.key, maxRetries: 0, timeout: 10_000 }).models.list({ limit: 1 });
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
        throw new BadRequestException('Kunci ditolak oleh layanan AI. Periksa kembali kunci Anda.');
      }
      verified = false; // mis. tidak ada internet: simpan saja, akan terbukti saat dipakai
    }
    this.settings.setAnthropicKey(dto.key);
    return { saved: true, verified, keyHint: this.settings.keyHint };
  }

  @Delete('anthropic-key')
  @HttpCode(204)
  @UseGuards(AdminGuard)
  clearKey() {
    this.settings.setAnthropicKey(null);
  }
}
