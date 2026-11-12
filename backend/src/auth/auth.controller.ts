import { Body, Controller, ForbiddenException, Get, HttpCode, Logger, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { LoginDto, RegisterDto } from './auth.dto.js';
import { AUTH_COOKIE, AuthGuard, CurrentUser, type AuthUser } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { GoogleService } from './google.service.js';

const STATE_COOKIE = 'mib_oauth_state';
const STATE_PATH = '/auth/google';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly google: GoogleService,
    private readonly config: ConfigService,
  ) {}

  private get frontendUrl() {
    return this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
  }

  private get secureCookies() {
    return this.config.get('NODE_ENV') === 'production';
  }

  private setCookie(res: Response, token: string) {
    res.cookie(AUTH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.secureCookies,
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.auth.register(dto);
    this.setCookie(res, token);
    return user;
  }

  /**
   * Masuk otomatis aplikasi desktop. Hanya aktif bila MIB_LOCAL=1 dan token rahasia (dibuat
   * aplikasi desktop tiap dijalankan, tidak pernah ke jaringan) cocok.
   */
  @Get('local-start')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async localStart(@Query('t') t: string | undefined, @Res() res: Response) {
    const secret = process.env.MIB_LOCAL_TOKEN ?? '';
    const a = Buffer.from(t ?? '');
    const b = Buffer.from(secret);
    if (process.env.MIB_LOCAL !== '1' || !secret || a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new ForbiddenException();
    }
    const { token } = await this.auth.localStart();
    res.cookie(AUTH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.secureCookies,
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });
    return res.redirect('/app');
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.auth.login(dto);
    this.setCookie(res, token);
    return user;
  }

  /** Awal login Google: simpan state anti-CSRF di cookie pendek, lalu arahkan ke Google. */
  @Get('google')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  googleStart(@Res() res: Response) {
    const started = this.google.buildAuthUrl();
    if (!started) return res.redirect(`${this.frontendUrl}/masuk?error=google_off`);
    res.cookie(STATE_COOKIE, started.state, {
      httpOnly: true,
      sameSite: 'lax', // harus lax: callback datang lewat navigasi lintas situs dari Google
      secure: this.secureCookies,
      maxAge: 10 * 60 * 1000,
      path: STATE_PATH,
    });
    return res.redirect(started.url);
  }

  @Get('google/callback')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') oauthError: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const fail = (reason: string) => res.redirect(`${this.frontendUrl}/masuk?error=${reason}`);
    const expected = (req.cookies as Record<string, string> | undefined)?.[STATE_COOKIE];
    res.clearCookie(STATE_COOKIE, { path: STATE_PATH });

    if (oauthError) return fail(oauthError === 'access_denied' ? 'google_batal' : 'google_gagal');
    if (!code || !state || !expected) return fail('google_gagal');
    const a = Buffer.from(state);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return fail('google_gagal');

    try {
      const profile = await this.google.fetchProfile(code);
      const { token } = await this.auth.loginWithGoogle(profile);
      this.setCookie(res, token);
      return res.redirect(`${this.frontendUrl}/app`);
    } catch (err) {
      if (err instanceof ForbiddenException) return fail('akun_diblokir');
      this.logger.error(err instanceof Error ? err.message : String(err));
      return fail('google_gagal');
    }
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(AUTH_COOKIE, { path: '/' });
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}
