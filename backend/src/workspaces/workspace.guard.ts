import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from '../auth/auth.guard.js';

export type WorkspaceRoleName = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface WorkspaceAccess {
  workspaceId: string;
  role: WorkspaceRoleName;
}

type WorkspaceRequest = Request & { user?: AuthUser; workspace?: WorkspaceAccess };

const ROLES_KEY = 'workspace_roles';

/** Membatasi rute ke peran tertentu di workspace (tanpa dekorator: semua anggota boleh). */
export const WorkspaceRoles = (...roles: WorkspaceRoleName[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Dipasang SETELAH AuthGuard pada rute berparameter :workspaceId. Hanya anggota yang lolos; bukan anggota
 * mendapat 404 (sama dengan workspace yang tidak ada), sehingga keberadaan workspace orang lain tidak bocor.
 */
@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<WorkspaceRequest>();
    const workspaceId = (req.params as Record<string, string | undefined>).workspaceId;
    if (!req.user || !workspaceId || !/^[0-9a-f-]{36}$/i.test(workspaceId)) throw new NotFoundException('Workspace tidak ditemukan');

    const membership = await this.prisma.membership.findUnique({
      where: { userId_workspaceId: { userId: req.user.id, workspaceId } },
      select: { role: true },
    });
    if (!membership) throw new NotFoundException('Workspace tidak ditemukan');

    const allowed = this.reflector.getAllAndOverride<WorkspaceRoleName[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed && !allowed.includes(membership.role)) {
      throw new ForbiddenException('Peran Anda di workspace ini tidak boleh melakukan tindakan tersebut');
    }
    req.workspace = { workspaceId, role: membership.role };
    return true;
  }
}

export const CurrentWorkspace = createParamDecorator((_: unknown, ctx: ExecutionContext): WorkspaceAccess => {
  return ctx.switchToHttp().getRequest<WorkspaceRequest>().workspace!;
});
