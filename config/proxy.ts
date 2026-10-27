/**
 * @name 代理的配置
 * @see 代理仅在本地开发时生效，生产环境请经网关转发
 * @doc https://umijs.org/docs/guides/proxy
 */
export default {
  dev: {
    '/api/': {
      // 本地 Go 后端服务 (ai-agent/apps/backend, 默认端口 8000)
      target: 'http://localhost:8000',
      changeOrigin: true,
    },
  },
  test: {
    '/api/': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    },
  },
  pre: {
    '/api/': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    },
  },
};
