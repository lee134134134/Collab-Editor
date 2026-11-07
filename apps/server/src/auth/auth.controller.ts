import type { LoginRequest, LoginResponse, UserDTO } from '@collab/shared';
import {
  Body,
  Controller,
  Get,
  HttpException,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import type { JwtPayload } from './jwt-payload.js';

@Controller('api/auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() body: LoginRequest): LoginResponse {
    // 缺参同样落入「用户名或密码错误」，避免泄露账号是否存在
    return this.authService.login(body?.username ?? '', body?.password ?? '');
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: JwtPayload): UserDTO {
    const found = this.authService.findById(user.sub);
    if (!found) {
      throw new HttpException({ message: '用户不存在' }, 404);
    }
    return found;
  }
}
