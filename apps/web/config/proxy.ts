/**
 * @name 代理的配置
 * @see 代理仅在本地开发时生效，生产环境请经网关转发
 * @doc https://umijs.org/docs/guides/proxy
 */
export default {
  dev: {
    '/api/': {
      // Lane B 后端 REST 服务（默认端口 3000）
      target: 'http://localhost:3000',
      changeOrigin: true,
    },
  },
  test: {
    '/api/': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    },
  },
  pre: {
    '/api/': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    },
  },
};
