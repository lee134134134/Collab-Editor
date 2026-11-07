import type { Settings as LayoutSettings } from '@ant-design/pro-components';
import type { RequestConfig, RunTimeLayoutConfig } from '@umijs/max';
import { history } from '@umijs/max';
import React from 'react';
import {
  AvatarDropdown,
  ErrorBoundary,
  Footer,
  OfflineBanner,
} from '@/components';
import { getMe } from '@/services/self/auth';
import defaultSettings from '../config/defaultSettings';
import { errorConfig } from './requestErrorConfig';

const loginPath = '/user/login';

export interface CurrentUser {
  name?: string;
  displayName?: string;
  color?: string;
}

/**
 * @name 初始状态
 * 有 token 时调用 GET /api/auth/me 拉取当前用户；失败则清 token 并视为未登录。
 */
export async function getInitialState(): Promise<{
  settings?: Partial<LayoutSettings>;
  currentUser?: CurrentUser;
  fetchUserInfo?: () => Promise<CurrentUser | undefined>;
}> {
  const fetchUserInfo = async (): Promise<CurrentUser | undefined> => {
    const token = localStorage.getItem('token');
    if (!token) return undefined;
    try {
      const user = await getMe({ skipErrorHandler: true });
      return {
        name: user.displayName ?? user.username,
        displayName: user.displayName,
        color: user.color,
      };
    } catch {
      // /me 失败说明 token 已失效
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      return undefined;
    }
  };

  const currentUser = await fetchUserInfo();

  return {
    fetchUserInfo,
    currentUser,
    settings: defaultSettings as Partial<LayoutSettings>,
  };
}

// ProLayout 支持的api https://procomponents.ant.design/components/layout
export const layout: RunTimeLayoutConfig = ({ initialState }) => {
  return {
    avatarProps: {
      title:
        initialState?.currentUser?.displayName ??
        initialState?.currentUser?.name ??
        '用户',
      render: (_, avatarChildren) => (
        <AvatarDropdown>{avatarChildren}</AvatarDropdown>
      ),
    },
    footerRender: () => <Footer />,
    onPageChange: () => {
      const { location } = history;
      // 未登录访问受保护页面时重定向到登录页
      if (!initialState?.currentUser?.name && location.pathname !== loginPath) {
        const { pathname, search } = location;
        history.replace(
          `${loginPath}?redirect=${encodeURIComponent(pathname + search)}`,
        );
      }
    },
    menuHeaderRender: undefined,
    ...initialState?.settings,
  };
};

/**
 * @name request 配置（axios 底座）
 * - 拦截器统一附带 Bearer token（登录后所有 /api 请求都需要鉴权）
 * - 错误处理见 requestErrorConfig; 服务层路径自带 /api 前缀, 不设 baseURL
 * @doc https://umijs.org/docs/max/request#配置
 */
export const request: RequestConfig = {
  timeout: 15000,
  requestInterceptors: [
    (config: any) => {
      const token = localStorage.getItem('token');
      if (token && config?.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
  ],
  ...errorConfig,
};

export function rootContainer(container: React.ReactNode) {
  return (
    <>
      <OfflineBanner />
      <ErrorBoundary>{container}</ErrorBoundary>
    </>
  );
}
