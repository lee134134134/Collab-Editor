import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import type { AppConfig } from '../config.js';
import { CONFIG } from '../config.js';
import type { JwtPayload } from './jwt-payload.js';

/** 鉴权后的请求体上挂载 user 载荷。 */
export interface AuthedRequest {
  user: JwtPayload;
}

/**
 * Bearer 鉴权守卫：解析 Authorization: Bearer <token>，校验 JWT 后把 { sub, username }
 * 挂到 req.user，供 CurrentUser 参数装饰器读取。
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx
      .switchToHttp()
      .getRequest<
        AuthedRequest & { headers: Record<string, string | undefined> }
      >();
    // Node 会把请求头统一小写，直接取 authorization 即可
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      throw new HttpException({ message: '未登录' }, 401);
    }
    const token = auth.slice('Bearer '.length).trim();
    try {
      const payload = jwt.verify(
        token,
        this.config.jwtSecret,
      ) as unknown as JwtPayload;
      req.user = payload;
      return true;
    } catch {
      throw new HttpException({ message: '登录已过期，请重新登录' }, 401);
    }
  }
}
