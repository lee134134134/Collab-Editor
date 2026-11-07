import { Module } from '@nestjs/common';
import { CollabModule } from '../collab/collab.module.js';
import { DocsController } from './docs.controller.js';
import { DocsService } from './docs.service.js';

@Module({
  imports: [CollabModule],
  controllers: [DocsController],
  providers: [DocsService],
})
export class DocsModule {}
