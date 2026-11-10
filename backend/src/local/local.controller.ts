import { stat } from 'node:fs/promises';
import path from 'node:path';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../workspaces/audit.service.js';
import { CurrentWorkspace, WorkspaceGuard, WorkspaceRoles, type WorkspaceAccess } from '../workspaces/workspace.guard.js';
import { ApprovalsService } from './approvals.service.js';
import { realpathLoose } from './paths.js';

class AddFolderDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  path!: string;

  @IsIn(['READ', 'READWRITE'])
  mode!: 'READ' | 'READWRITE';
}

class DecisionDto {
  @IsBoolean()
  allow!: boolean;
}

@Controller('workspaces/:workspaceId')
@UseGuards(AuthGuard, WorkspaceGuard)
export class LocalController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly approvals: ApprovalsService,
    private readonly audit: AuditService,
  ) {}

  @Get('folders')
  folders(@CurrentWorkspace() ws: WorkspaceAccess) {
    return this.prisma.allowedFolder.findMany({
      where: { workspaceId: ws.workspaceId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, path: true, mode: true },
    });
  }

  @Post('folders')
  @WorkspaceRoles('OWNER', 'ADMIN')
  async addFolder(@CurrentUser() user: AuthUser, @CurrentWorkspace() ws: WorkspaceAccess, @Body() dto: AddFolderDto) {
    if (!path.isAbsolute(dto.path)) throw new BadRequestException('Gunakan jalur absolut, mis. C:\\Dokumen\\Kantor');
    let real: string;
    try {
      real = await realpathLoose(path.resolve(dto.path));
      if (!(await stat(real)).isDirectory()) throw new Error('bukan folder');
    } catch {
      throw new BadRequestException('Folder tidak ditemukan');
    }
    // Akar drive / direktori sistem terlalu luas: izin sekecil mungkin.
    if (path.parse(real).root === real || path.dirname(real) === real) {
      throw new BadRequestException('Pilih folder tertentu, bukan seluruh drive');
    }
    const dup = await this.prisma.allowedFolder.findUnique({
      where: { workspaceId_path: { workspaceId: ws.workspaceId, path: real } },
      select: { id: true },
    });
    if (dup) throw new ConflictException('Folder ini sudah ada di daftar');
    const folder = await this.prisma.allowedFolder.create({
      data: { workspaceId: ws.workspaceId, path: real, mode: dto.mode },
      select: { id: true, path: true, mode: true },
    });
    await this.audit.log({ workspaceId: ws.workspaceId, actorId: user.id, actorEmail: user.email, action: 'folder.added', target: real, detail: dto.mode });
    return folder;
  }

  @Delete('folders/:folderId')
  @HttpCode(204)
  @WorkspaceRoles('OWNER', 'ADMIN')
  async removeFolder(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ws: WorkspaceAccess,
    @Param('folderId', ParseUUIDPipe) folderId: string,
  ) {
    const f = await this.prisma.allowedFolder.findFirst({ where: { id: folderId, workspaceId: ws.workspaceId } });
    if (!f) return;
    await this.prisma.allowedFolder.delete({ where: { id: folderId } });
    await this.audit.log({ workspaceId: ws.workspaceId, actorId: user.id, actorEmail: user.email, action: 'folder.removed', target: f.path });
  }

  /** Jawaban pengguna untuk permintaan izin yang sedang ditunggu agen. */
  @Post('approvals/:approvalId')
  @HttpCode(200)
  decide(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ws: WorkspaceAccess,
    @Param('approvalId', ParseUUIDPipe) approvalId: string,
    @Body() dto: DecisionDto,
  ) {
    return this.approvals.decide(ws.workspaceId, user.id, approvalId, dto.allow);
  }

  @Get('approvals')
  history(@CurrentUser() user: AuthUser, @CurrentWorkspace() ws: WorkspaceAccess, @Query('take') take?: string) {
    return this.approvals.history(ws.workspaceId, user.id, take ? Number(take) : undefined);
  }
}
