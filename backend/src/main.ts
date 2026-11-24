import { existsSync } from 'node:fs';
import path from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { prepareRuntime } from './runtime/bootstrap.js';

const frontendDir = process.env.MIB_FRONTEND_DIR ? path.resolve(process.env.MIB_FRONTEND_DIR) : null;

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
  const { AppModule } = await import('./app.module.js');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(
    helmet(
      frontendDir
        ? {
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
            hsts: false,
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
    const { DocumentBuilder, SwaggerModule } = await import('@nestjs/swagger');
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('MIB API').setVersion('0.1').addBearerAuth().build(),
    );
    SwaggerModule.setup('docs', app, doc);
  }

  const host = process.env.HOST ?? '127.0.0.1';
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, host);
  console.log(`[MiB] siap di http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
}


await bootstrap();
