import { Body, Controller, Get, HttpCode, PayloadTooLargeException, Post, Req, Res, UseGuards } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import type { Request, Response } from 'express';
import { AuthGuard } from '../auth/auth.guard.js';
import { VoiceService } from './voice.service.js';

const MAX_WAV = 44 + 65 * 32_000;

class SpeakDto {
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  text!: string;
}

@Controller('voice')
@UseGuards(AuthGuard)
export class VoiceController {
  constructor(private readonly voice: VoiceService) {}

  @Get()
  status() {
    return this.voice.status();
  }

  @Post('setup')
  @HttpCode(200)
  setup() {
    return this.voice.setup();
  }

  @Post('open-settings')
  @HttpCode(200)
  openSettings() {
    return this.voice.openVoiceSettings();
  }

  @Post('transcribe')
  @HttpCode(200)
  async transcribe(@Req() req: Request) {
    const parts: Buffer[] = [];
    let size = 0;
    for await (const c of req as AsyncIterable<Buffer>) {
      size += c.length;
      if (size > MAX_WAV) throw new PayloadTooLargeException('Rekaman terlalu panjang.');
      parts.push(c);
    }
    return this.voice.transcribe(Buffer.concat(parts));
  }

  @Post('speak')
  @HttpCode(200)
  async speak(@Body() dto: SpeakDto, @Res() res: Response) {
    const wav = await this.voice.speak(dto.text);
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'no-store');
    res.end(wav);
  }
}
