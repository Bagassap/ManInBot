import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { AgentModule } from '../agent/agent.module.js';
import { ConversationsController } from './conversations.controller.js';
import { ConversationsService } from './conversations.service.js';

@Module({
  imports: [AgentModule, WorkspacesModule, SettingsModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
})
export class ConversationsModule {}
