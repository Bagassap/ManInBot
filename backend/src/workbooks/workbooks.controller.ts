import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { AuditService } from '../workspaces/audit.service.js';
import { CurrentWorkspace, WorkspaceGuard, type WorkspaceAccess } from '../workspaces/workspace.guard.js';
import { WorkbooksService } from './workbooks.service.js';
import { MAX_UPLOAD_BYTES } from './xlsx-io.js';

@Controller('workspaces/:workspaceId/conversations/:id/workbook')
@UseGuards(AuthGuard, WorkspaceGuard)
export class WorkbooksController {
  constructor(
    private readonly workbooks: WorkbooksService,
    private readonly audit: AuditService,
  ) {}

  /** Potret lembar kerja saat ini (null bila belum ada). */
  @Get()
  async get(@CurrentUser() user: AuthUser, @CurrentWorkspace() ws: WorkspaceAccess, @Param('id', ParseUUIDPipe) id: string) {
    return { workbook: await this.workbooks.getSnapshot(ws.workspaceId, user.id, id) };
  }

  /** Unggah berkas .xlsx: menggantikan lembar kerja percakapan ini. */
  @Post('import')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 0 } }))
  async import(
    @CurrentUser() user: AuthUser,
    @CurrentWorkspace() ws: WorkspaceAccess,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: { buffer: Buffer; originalname: string } | undefined,
  ) {
    if (!file) throw new BadRequestException('Berkas tidak ditemukan. Kirim sebagai form-data dengan nama "file".');
    const workbook = await this.workbooks.importFile(ws.workspaceId, user.id, id, file.buffer, file.originalname);
    await this.audit.log({ workspaceId: ws.workspaceId, actorId: user.id, actorEmail: user.email, action: 'workbook.imported', target: id, detail: file.originalname });
    return { workbook };
  }

  /**
   * Unduh lembar kerja sebagai .xlsx. Tanpa Content-Disposition: frontend mengambilnya lewat fetch lalu
   * menyimpannya dengan nama sendiri, dan header "attachment" membuat Chrome membatalkan fetch lintas-origin.
   */
  @Get('download')
  async download(@CurrentUser() user: AuthUser, @CurrentWorkspace() ws: WorkspaceAccess, @Param('id', ParseUUIDPipe) id: string) {
    const { buffer, name } = await this.workbooks.exportFile(ws.workspaceId, user.id, id);
    await this.audit.log({ workspaceId: ws.workspaceId, actorId: user.id, actorEmail: user.email, action: 'workbook.exported', target: id, detail: name });
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }
}
