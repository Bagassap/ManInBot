import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';

export const AUTH_COOKIE = 'mib_token';

export interface AuthUser {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
}

type AuthedRequest = Request & { user?: AuthUser };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = (req.cookies as Record<string, string> | undefined)?.[AUTH_COOKIE];
    if (!token) throw new UnauthorizedException();
    let payload: { sub: string; iat?: number };
    try {
      payload = await this.jwt.verifyAsync<{ sub: string; iat?: number }>(token);
    } catch {
      throw new UnauthorizedException();
    }

    // Status akun dibaca dari database pada setiap permintaan, jadi blokir, pencabutan sesi,
    // penghapusan akun, dan perubahan peran langsung berlaku (tidak menunggu token kedaluwarsa).
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, blockedAt: true, sessionsValidAfter: true },
    });
    if (!user) throw new UnauthorizedException();
    if (user.blockedAt) throw new ForbiddenException('Akun diblokir. Hubungi admin.');
    if (user.sessionsValidAfter && (payload.iat ?? 0) * 1000 < user.sessionsValidAfter.getTime()) {
      throw new UnauthorizedException();
    }
    req.user = { id: user.id, email: user.email, role: user.role };
    return true;
  }
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().user!;
});
