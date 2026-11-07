import type { LoginRequest, LoginResponse, UserDTO } from '@collab/shared';
import { request } from '@umijs/max';

export type { LoginRequest, LoginResponse, UserDTO };

/** 登录（POST /api/auth/login） */
export async function login(
  body: LoginRequest,
  options?: { skipErrorHandler?: boolean },
) {
  return request<LoginResponse>('/api/auth/login', {
    method: 'POST',
    data: body,
    ...(options ?? {}),
  });
}

/** 获取当前登录用户（GET /api/auth/me） */
export async function getMe(options?: { skipErrorHandler?: boolean }) {
  return request<UserDTO>('/api/auth/me', {
    method: 'GET',
    ...(options ?? {}),
  });
}

/**
 * 申请协同文档 WS 连接 ticket（POST /api/collab/ticket）
 * 后端校验登录态后返回一次性/短时有效的 ticket，用于 ws://localhost:3001/{docId}?ticket=xxx
 */
export async function getCollabTicket(options?: { skipErrorHandler?: boolean }) {
  return request<{ ticket: string }>('/api/collab/ticket', {
    method: 'POST',
    ...(options ?? {}),
  });
}

/**
 * 登出：后端无状态登出接口，本地清理 token 即可。
 * 调用方负责 localStorage.removeItem('token') 并跳转。
 */
export async function logout() {
  return undefined;
}
