import { Module } from '@nestjs/common';
import { BrainModule } from '../brain/brain.module.js';
import { VoiceController } from './voice.controller.js';
import { VoiceService } from './voice.service.js';

@Module({ imports: [BrainModule], controllers: [VoiceController], providers: [VoiceService] })
export class VoiceModule {}
