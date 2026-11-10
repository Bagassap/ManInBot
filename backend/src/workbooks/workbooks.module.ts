import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { WorkbooksController } from './workbooks.controller.js';
import { WorkbooksService } from './workbooks.service.js';

@Module({
  imports: [WorkspacesModule],
  controllers: [WorkbooksController],
  providers: [WorkbooksService],
  exports: [WorkbooksService],
})
export class WorkbooksModule {}
