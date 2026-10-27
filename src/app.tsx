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
import defaultSettings from '../config/defaultSettings';
import { errorConfig } from './requestErrorConfig';

const loginPath = '/user/login';

export interface CurrentUser {
  name?: string;
}

/**
 * @name 本项目后端无 /me 接口, 登录态仅存在于 localStorage
 * (key: token / username, 由登录页写入)
 */
function getLocalUser(): CurrentUser {
  if (!localStorage.getItem('token')) return {};
  const name = localStorage.getItem('username');
  return { name: name ?? '用户' };
}

/**
 * @see https://umijs.org/docs/api/runtime-config#getinitialstate
 * */
export async function getInitialState(): Promise<{
  settings?: Partial<LayoutSettings>;
  currentUser?: CurrentUser;
  fetchUserInfo?: () => CurrentUser;
}> {
  const fetchUserInfo = () => getLocalUser();
  const currentUser = fetchUserInfo();
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
      title: initialState?.currentUser?.name ?? '用户',
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
 * 错误处理见 requestErrorConfig; 服务层路径自带 /api 前缀, 不设 baseURL
 * @doc https://umijs.org/docs/max/request#配置
 */
export const request: RequestConfig = {
  timeout: 15000,
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
