import type {
  CreateDocRequest,
  DocMeta,
  UpdateDocRequest,
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
import { DocsService } from './docs.service.js';

@Controller('api/docs')
@UseGuards(JwtAuthGuard)
export class DocsController {
  constructor(@Inject(DocsService) private readonly docsService: DocsService) {}

  @Get()
  list(): DocMeta[] {
    return this.docsService.list();
  }

  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateDocRequest,
  ): DocMeta {
    return this.docsService.create(user.sub, body?.title);
  }

  @Get(':id')
  get(@Param('id') id: string): DocMeta {
    return this.docsService.get(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateDocRequest): DocMeta {
    return this.docsService.update(id, body?.title);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string): void {
    this.docsService.remove(id);
  }
}
