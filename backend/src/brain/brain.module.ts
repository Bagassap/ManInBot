import { Module } from '@nestjs/common';
import { BrainController } from './brain.controller.js';
import { BrainService } from './brain.service.js';

@Module({ controllers: [BrainController], providers: [BrainService], exports: [BrainService] })
export class BrainModule {}
