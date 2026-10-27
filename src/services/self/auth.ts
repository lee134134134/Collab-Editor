import { request } from '@umijs/max';

export interface LoginResult {
  token: string;
  name: string;
}

/** 登录（POST /api/auth/login） */
export async function login(
  username: string,
  password: string,
  options?: { skipErrorHandler?: boolean },
) {
  return request<LoginResult>('/api/auth/login', {
    method: 'POST',
    data: { username, password },
    ...(options ?? {}),
  });
}

/**
 * 登出：后端无登出接口，服务端无状态。
 * 本地数据（localStorage key: token/username）由调用方清理。
 */
export async function logout() {
  return undefined;
}
