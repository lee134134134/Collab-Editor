import type { LoginResponse, UserDTO } from '@collab/shared';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { AppConfig } from '../config.js';
import { CONFIG } from '../config.js';
import type { UserRow } from '../db/database.js';
import { DbService } from '../db/database.js';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DbService) private readonly db: DbService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  /** 数据库用户行 → 对外 DTO（密码哈希绝不外泄）。 */
  toUserDTO(row: UserRow): UserDTO {
    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      color: row.color ?? '#f0883e',
    };
  }

  /** 登录校验：bcrypt 比对，签发 7d JWT。错凭据按契约返回 400（非 401）。 */
  login(username: string, password: string): LoginResponse {
    const user = this.db.db
      .prepare<[string], UserRow>('SELECT * FROM users WHERE username = ?')
      .get(username);
    if (
      !user?.password_hash ||
      !bcrypt.compareSync(password, user.password_hash)
    ) {
      // 契约约定：用户名或密码错误 → 400 { message }
      throw new HttpException({ message: '用户名或密码错误' }, 400);
    }
    const token = jwt.sign(
      { sub: user.id, username: user.username },
      this.config.jwtSecret,
      {
        expiresIn: '7d',
      },
    );
    return { token, user: this.toUserDTO(user) };
  }

  /** 按 id 查用户，供 /auth/me 使用。 */
  findById(id: number): UserDTO | null {
    const user = this.db.db
      .prepare<[number], UserRow>('SELECT * FROM users WHERE id = ?')
      .get(id);
    return user ? this.toUserDTO(user) : null;
  }
}
