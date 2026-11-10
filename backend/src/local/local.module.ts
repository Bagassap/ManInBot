import { Module } from '@nestjs/common';
import { WorkbooksModule } from '../workbooks/workbooks.module.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { ApprovalsService } from './approvals.service.js';
import { ComputerService } from './computer.js';
import { LocalController } from './local.controller.js';
import { LocalToolsService } from './local.service.js';

@Module({
  imports: [WorkspacesModule, WorkbooksModule],
  controllers: [LocalController],
  providers: [ApprovalsService, ComputerService, LocalToolsService],
  exports: [LocalToolsService, ApprovalsService],
})
export class LocalModule {}
