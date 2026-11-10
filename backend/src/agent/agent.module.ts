import { Module } from '@nestjs/common';
import { LocalModule } from '../local/local.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { WorkbooksModule } from '../workbooks/workbooks.module.js';
import { AgentService } from './agent.service.js';

@Module({ imports: [WorkbooksModule, LocalModule, SettingsModule], providers: [AgentService], exports: [AgentService] })
export class AgentModule {}
