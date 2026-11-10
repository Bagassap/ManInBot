import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { AuditService } from './audit.service.js';
import { AddMemberDto, ChangeRoleDto, CreateWorkspaceDto } from './workspaces.dto.js';
import { CurrentWorkspace, WorkspaceGuard, WorkspaceRoles, type WorkspaceAccess } from './workspace.guard.js';
import { WorkspacesService } from './workspaces.service.js';

@Controller('workspaces')
@UseGuards(AuthGuard)
export class WorkspacesController {
  constructor(
    private readonly workspaces: WorkspacesService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.workspaces.listMine(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWorkspaceDto) {
    return this.workspaces.create(user, dto.name);
  }

  @Patch(':workspaceId')
  @UseGuards(WorkspaceGuard)
  @WorkspaceRoles('OWNER', 'ADMIN')
  rename(@CurrentUser() user: AuthUser, @CurrentWorkspace() ws: WorkspaceAccess, @Body() dto: CreateWorkspaceDto) {
    return this.workspaces.rename(user, ws.workspaceId, dto.name);
  }

  @Delete(':workspaceId')
  @HttpCode(204)
  @UseGuards(WorkspaceGuard)
  @WorkspaceRoles('OWNER')
  remove(@CurrentWorkspace() ws: WorkspaceAccess) {
    return this.workspaces.remove(ws.workspaceId);
  }

  @Get(':workspaceId/members')
  @UseGuards(WorkspaceGuard)
  members(@CurrentWorkspace() ws: WorkspaceAccess) {
    return this.workspaces.members(ws.workspaceId);
  }

  @Post(':workspaceId/members')
  @UseGuards(WorkspaceGuard)
  @WorkspaceRoles('OWNER', 'ADMIN')
  addMember(@CurrentUser() user: AuthUser, @CurrentWorkspace() ws: WorkspaceAccess, @Body() dto: AddMemberDto) {
    return this.workspaces.addMember(user, ws.role, ws.workspaceId, dto.email, dto.role ?? 'MEMBER');
  }

  @Patch(':workspaceId/members/:userId')
  @UseGuards(WorkspaceGuard)
  @WorkspaceRoles('OWNER', 'ADMIN')
  async changeRole(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ws: WorkspaceAccess,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: ChangeRoleDto,
  ) {
    await this.workspaces.changeRole(user, ws.role, ws.workspaceId, userId, dto.role);
    return { ok: true };
  }

  /** Semua anggota boleh memanggil ini untuk dirinya sendiri (keluar); mengeluarkan orang lain dicek di service. */
  @Delete(':workspaceId/members/:userId')
  @HttpCode(204)
  @UseGuards(WorkspaceGuard)
  removeMember(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ws: WorkspaceAccess,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.workspaces.removeMember(user, ws.role, ws.workspaceId, userId);
  }

  @Delete(':workspaceId/invites/:inviteId')
  @HttpCode(204)
  @UseGuards(WorkspaceGuard)
  @WorkspaceRoles('OWNER', 'ADMIN')
  revokeInvite(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ws: WorkspaceAccess,
    @Param('inviteId', ParseUUIDPipe) inviteId: string,
  ) {
    return this.workspaces.revokeInvite(user, ws.workspaceId, inviteId);
  }

  @Get(':workspaceId/audit')
  @UseGuards(WorkspaceGuard)
  @WorkspaceRoles('OWNER', 'ADMIN')
  auditLog(
    @CurrentWorkspace() ws: WorkspaceAccess,
    @Query('before') before?: string,
    @Query('take') take?: string,
    @Query('action') action?: string,
  ) {
    return this.audit.list(ws.workspaceId, { before, take: take ? Number(take) : undefined, action });
  }
}
