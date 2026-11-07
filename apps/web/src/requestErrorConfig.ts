import type { RequestConfig } from '@umijs/max';
import { history } from '@umijs/max';
import { message } from 'antd';

/**
 * @name 错误处理
 * 后端约定: 响应为裸 JSON, 错误时 HTTP 非 2xx + { message?: string }
 * (与 ant-design-pro demo 的 success/envelope 结构不同)
 * @doc https://umijs.org/docs/max/request#配置
 */
export const errorConfig: RequestConfig = {
  errorConfig: {
    errorHandler: (error: any, opts: any) => {
      if (opts?.skipErrorHandler) throw error;

      const status = error?.response?.status;
      if (status === 401) {
        // token 失效: 清理登录态并跳转登录页
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        const { pathname, search } = history.location;
        message.error('登录已失效，请重新登录');
        history.replace(
          `/user/login?redirect=${encodeURIComponent(pathname + search)}`,
        );
        return;
      }

      if (error?.response) {
        message.error(error.response.data?.message ?? '请求失败，请稍后重试');
        return;
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        message.error('网络异常，请检查网络连接');
        return;
      }

      message.error('请求失败，请稍后重试');
    },
  },
};
