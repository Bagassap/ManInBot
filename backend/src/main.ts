import { existsSync } from 'node:fs';
import path from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { prepareRuntime } from './runtime/bootstrap.js';

/** Folder hasil ekspor statis frontend. Bila diisi, backend menyajikan antarmuka sendiri (satu port, satu origin). */
const frontendDir = process.env.MIB_FRONTEND_DIR ? path.resolve(process.env.MIB_FRONTEND_DIR) : null;

/** Memetakan /app -> app.html, / -> index.html dst. (ekspor statis Next menghasilkan satu berkas .html per halaman). */
function htmlPages(dir: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    let rel: string;
    try {
      rel = decodeURIComponent(req.path).replace(/\/+$/, '') || '/index';
    } catch {
      return next();
    }
    if (rel.includes('..') || rel.includes('\0')) return next();
    // Prefetch segmen Next meminta "__next.a.b.__PAGE__.txt"; di disk berkasnya "__next.a/b/__PAGE__.txt".
    const seg = /^(.*\/)?__next\.([^/]+)\.txt$/.exec(rel);
    if (seg && !existsSync(path.join(dir, rel))) {
      const mapped = `${(seg[1] ?? '').replace(/^\/+/, '')}__next.${seg[2].replace(/\./g, '/')}.txt`;
      if (existsSync(path.join(dir, mapped))) return void res.sendFile(mapped, { root: dir, dotfiles: 'deny' });
    }
    if (path.extname(rel)) return next();
    const file = `${rel.replace(/^\/+/, '')}.html`;
    if (!existsSync(path.join(dir, file))) return next();
    res.sendFile(file, { root: dir, dotfiles: 'deny' });
  };
}

async function bootstrap() {
  await prepareRuntime((m) => console.log(`[MiB] ${m}`));
  // Diimpor setelah prepareRuntime: modul membaca JWT_SECRET/DATABASE_URL saat dibuat.
  const { AppModule } = await import('./app.module.js');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(
    helmet(
      frontendDir
        ? {
            // Ekspor statis Next memakai skrip inline untuk hidrasi; sisanya tetap dikunci ke origin sendiri.
            contentSecurityPolicy: {
              useDefaults: true,
              directives: {
                'script-src': ["'self'", "'unsafe-inline'"],
                'img-src': ["'self'", 'data:', 'blob:'],
                'media-src': ["'self'", 'blob:'],
                'connect-src': ["'self'"],
                'upgrade-insecure-requests': null,
              },
            },
            hsts: false, // layanan lokal lewat http://localhost
          }
        : undefined,
    ),
  );
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  if (frontendDir) {
    app.use(htmlPages(frontendDir));
    app.useStaticAssets(frontendDir, { redirect: false, index: false, dotfiles: 'deny' });
  }

  if (process.env.NODE_ENV !== 'production' && !frontendDir) {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('MIB API').setVersion('0.1').addBearerAuth().build(),
    );
    SwaggerModule.setup('docs', app, doc);
  }

  // Hanya bisa dijangkau dari komputer ini. Untuk server (Docker dsb.) set HOST=0.0.0.0 secara sengaja.
  const host = process.env.HOST ?? '127.0.0.1';
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, host);
  console.log(`[MiB] siap di http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
}


await bootstrap();
