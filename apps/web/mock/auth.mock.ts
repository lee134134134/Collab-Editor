/**
 * 登录接口 mock（npm start 开启 mock 时生效）
 * 真实后端见 ai-agent/apps/backend，默认账号 admin / admin123
 */
export default {
  'POST /api/auth/login': (req: any, res: any) => {
    const { username, password } = req.body ?? {};
    if (username === 'admin' && password === 'admin123') {
      res.json({
        token: `mock-token-${Date.now()}`,
        name: '管理员',
      });
    } else {
      res.status(401).json({ message: '用户名或密码错误' });
    }
  },
};
