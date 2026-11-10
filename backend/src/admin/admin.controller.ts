import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { AdminGuard } from './admin.guard.js';
import { CreateUserDto, RangeDto, ResetPasswordDto, RunsQueryDto, UpdateUserDto } from './admin.dto.js';
import { AdminService } from './admin.service.js';

@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  overview(@Query() q: RangeDto) {
    return this.admin.overview(q.days);
  }

  @Get('runs')
  runs(@Query() q: RunsQueryDto) {
    return this.admin.runs(q);
  }

  @Get('runs/:id')
  runDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.runDetail(id);
  }

  @Get('users')
  users(@Query() q: RangeDto) {
    return this.admin.users(q.days);
  }

  @Post('users')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  createUser(@CurrentUser() actor: AuthUser, @Body() dto: CreateUserDto) {
    return this.admin.createUser(actor, dto);
  }

  @Patch('users/:id')
  updateUser(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.admin.updateUser(actor, id, dto);
  }

  @Post('users/:id/reset-password')
  @HttpCode(204)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  resetPassword(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ResetPasswordDto) {
    return this.admin.resetPassword(actor, id, dto);
  }

  @Post('users/:id/revoke-sessions')
  @HttpCode(204)
  revokeSessions(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.revokeSessions(actor, id);
  }

  @Delete('users/:id')
  @HttpCode(204)
  deleteUser(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.deleteUser(actor, id);
  }

  @Get('audit')
  audit() {
    return this.admin.auditLog(30);
  }
}
