import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service.js';
import type { LoginDto, RegisterDto } from './auth.dto.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';
import type { GoogleProfile } from './google.service.js';

// Hash asli untuk email yang tidak terdaftar, agar waktu respons login seragam.
const DUMMY_HASH = await argon2.hash('mib-dummy-password');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly workspaces: WorkspacesService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('Email sudah terdaftar');
    }
    // Instalasi lokal (MIB_LOCAL=1): pengguna pertama adalah pemilik komputer ini, jadi langsung admin.
    const first = process.env.MIB_LOCAL === '1' && (await this.prisma.user.count()) === 0;
    const user = await this.prisma.user.create({
      data: { email, name: dto.name?.trim() || null, passwordHash: await argon2.hash(dto.password), role: first ? 'ADMIN' : 'USER' },
    });
    await this.workspaces.provisionFor(user);
    return this.issue(user);
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    const ok = await argon2.verify(user?.passwordHash ?? DUMMY_HASH, dto.password).catch(() => false);
    if (!user || !ok) throw new UnauthorizedException('Email atau kata sandi salah');
    // Diperiksa setelah kata sandi benar, agar status blokir tidak bisa ditebak oleh orang lain.
    if (user.blockedAt) throw new ForbiddenException('Akun diblokir. Hubungi admin.');
    return this.issue(user);
  }

  /**
   * Masuk/daftar lewat Google. Google sudah memverifikasi kepemilikan email, jadi akun
   * berpassword dengan email yang sama aman ditautkan ke identitas Google ini.
   */
  async loginWithGoogle(profile: GoogleProfile) {
    let user = await this.prisma.user.findUnique({ where: { googleId: profile.sub } });
    let created = false;
    if (!user) {
      const byEmail = await this.prisma.user.findUnique({ where: { email: profile.email } });
      user = byEmail
        ? await this.prisma.user.update({
            where: { id: byEmail.id },
            data: { googleId: profile.sub, image: byEmail.image ?? profile.picture, name: byEmail.name ?? profile.name },
          })
        : await this.prisma.user.create({
            data: { email: profile.email, name: profile.name, image: profile.picture, googleId: profile.sub },
          });
      created = !byEmail;
    }
    if (user.blockedAt) throw new ForbiddenException('Akun diblokir. Hubungi admin.');
    if (created) await this.workspaces.provisionFor(user);
    return this.issue(user);
  }

  async me(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new UnauthorizedException();
    return this.publicUser(user);
  }

  private async issue(user: { id: string; email: string; name: string | null; role: 'USER' | 'ADMIN' }) {
    const token = await this.jwt.signAsync({ sub: user.id, email: user.email, role: user.role });
    return { token, user: this.publicUser(user) };
  }

  private publicUser(u: { id: string; email: string; name: string | null; role: 'USER' | 'ADMIN' }) {
    return { id: u.id, email: u.email, name: u.name, role: u.role };
  }
}
