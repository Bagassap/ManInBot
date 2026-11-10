import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AdminModule } from './admin/admin.module.js';
import { WorkbooksModule } from './workbooks/workbooks.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { LocalModule } from './local/local.module.js';
import { WorkspacesModule } from './workspaces/workspaces.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ConversationsModule } from './conversations/conversations.module.js';
import { DownloadModule } from './download/download.module.js';
import { HealthController } from './health/health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    WorkspacesModule,
    LocalModule,
    SettingsModule,
    AuthModule,
    AdminModule,
    WorkbooksModule,
    ConversationsModule,
    DownloadModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
