/** JWT HS256 载荷：sub 为用户 id，username 为用户名（7d 有效）。 */
export interface JwtPayload {
  sub: number;
  username: string;
}
