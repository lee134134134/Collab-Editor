import type {
  CommentDTO,
  CreateCommentRequest,
  UpdateCommentRequest,
} from '@collab/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/jwt-payload.js';
import { CommentsService } from './comments.service.js';

@Controller()
@UseGuards(JwtAuthGuard)
export class CommentsController {
  constructor(
    @Inject(CommentsService) private readonly commentsService: CommentsService,
  ) {}

  @Get('api/docs/:docId/comments')
  list(@Param('docId') docId: string): CommentDTO[] {
    return this.commentsService.list(docId);
  }

  @Post('api/docs/:docId/comments')
  create(
    @Param('docId') docId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateCommentRequest,
  ): CommentDTO {
    return this.commentsService.create(docId, user.sub, body ?? {});
  }

  @Patch('api/comments/:id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: UpdateCommentRequest,
  ): CommentDTO {
    return this.commentsService.update(id, body ?? {}, user);
  }

  @Delete('api/comments/:id')
  @HttpCode(204)
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload): void {
    this.commentsService.remove(id, user);
  }
}
