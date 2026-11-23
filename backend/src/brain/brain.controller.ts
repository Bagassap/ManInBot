import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { AdminGuard } from '../admin/admin.guard.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { BrainService, type BrainTier } from './brain.service.js';

class SetupDto {
  @IsIn(['ringan', 'sedang', 'kuat'])
  tier!: BrainTier;
}

@Controller('brain')
@UseGuards(AuthGuard)
export class BrainController {
  constructor(private readonly brain: BrainService) {}

  @Get()
  status() {
    return this.brain.status();
  }

  @Post('setup')
  @HttpCode(200)
  @UseGuards(AdminGuard)
  setup(@Body() dto: SetupDto) {
    return this.brain.setup(dto.tier);
  }

  @Post('cancel')
  @HttpCode(200)
  @UseGuards(AdminGuard)
  cancel() {
    return this.brain.cancelSetup();
  }
}
