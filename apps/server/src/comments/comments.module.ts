import { Module } from '@nestjs/common';
import { CollabModule } from '../collab/collab.module.js';
import { CommentsController } from './comments.controller.js';
import { CommentsService } from './comments.service.js';

@Module({
  imports: [CollabModule],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
