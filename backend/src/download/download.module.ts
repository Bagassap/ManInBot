import { Module } from '@nestjs/common';
import { DownloadController } from './download.controller.js';

@Module({ controllers: [DownloadController] })
export class DownloadModule {}
