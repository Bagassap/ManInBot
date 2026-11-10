import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth.guard.js';

/**
 * Hanya untuk akun ADMIN. Dipasang setelah AuthGuard, yang sudah membaca peran terbaru dari
 * database pada setiap permintaan, jadi pencabutan hak admin langsung berlaku.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<Request & { user?: AuthUser }>().user;
    if (user?.role !== 'ADMIN') throw new ForbiddenException('Khusus admin');
    return true;
  }
}
