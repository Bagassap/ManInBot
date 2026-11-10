import { Module } from '@nestjs/common';
import { AuditService } from './audit.service.js';
import { WorkspaceGuard } from './workspace.guard.js';
import { WorkspacesController } from './workspaces.controller.js';
import { WorkspacesService } from './workspaces.service.js';

@Module({
  controllers: [WorkspacesController],
  providers: [WorkspacesService, AuditService, WorkspaceGuard],
  exports: [WorkspacesService, AuditService, WorkspaceGuard],
})
export class WorkspacesModule {}
