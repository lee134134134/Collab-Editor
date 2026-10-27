import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { LoginForm, ProFormText } from '@ant-design/pro-components';
import { Helmet, useModel } from '@umijs/max';
import { Alert, App } from 'antd';
import { createStyles } from 'antd-style';
import React, { startTransition, useState } from 'react';
import { Footer } from '@/components';
import { login } from '@/services/self/auth';
import Settings from '../../../../config/defaultSettings';

/**
 * Validate redirect URL to prevent open redirect attacks.
 * Only allow same-origin relative paths starting with '/'.
 */
const getSafeRedirectUrl = (redirect: string | null): string => {
  if (!redirect?.startsWith('/')) return '/';

  if (redirect.startsWith('//')) return '/';

  try {
    const parsed = new URL(redirect, window.location.origin);
    if (parsed.origin !== window.location.origin) return '/';
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/';
  }
};

const useStyles = createStyles(({ token }) => {
  return {
    lang: {
      width: 42,
      height: 42,
      lineHeight: '42px',
      position: 'fixed',
      right: 16,
      borderRadius: token.borderRadius,
      ':hover': {
        backgroundColor: token.colorBgTextHover,
      },
    },
    container: {
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'auto',
      backgroundImage:
        "url('https://mdn.alipayobjects.com/yuyan_qk0oxh/afts/img/V-_oS6r-i7wAAAAAAAAAAAAAFl94AQBr')",
      backgroundSize: '100% 100%',
    },
  };
});

const LoginMessage: React.FC<{
  content: string;
}> = ({ content }) => {
  return (
    <Alert
      style={{
        marginBottom: 24,
      }}
      title={content}
      type="error"
      showIcon
    />
  );
};

const Login: React.FC = () => {
  const [errorMessage, setErrorMessage] = useState<string>();
  const { setInitialState } = useModel('@@initialState');
  const { styles } = useStyles();
  const { message } = App.useApp();

  const handleSubmit = async (values: {
    username: string;
    password: string;
  }) => {
    try {
      const data = await login(values.username, values.password, {
        skipErrorHandler: true,
      });
      localStorage.setItem('token', data.token);
      localStorage.setItem('username', data.name);
      message.success('登录成功');
      startTransition(() => {
        setInitialState((s) => ({
          ...s,
          currentUser: { name: data.name },
        }));
      });
      const urlParams = new URL(window.location.href).searchParams;
      const redirectUrl = getSafeRedirectUrl(urlParams.get('redirect'));
      window.location.href = redirectUrl;
    } catch (error: any) {
      const text = error?.response?.data?.message ?? '登录失败，请重试！';
      setErrorMessage(text);
    }
  };

  return (
    <div className={styles.container}>
      <Helmet>
        <title>
          登录
          {Settings.title && ` - ${Settings.title}`}
        </title>
      </Helmet>
      <div
        style={{
          flex: '1',
          padding: '32px 0',
        }}
      >
        <LoginForm
          contentStyle={{
            minWidth: 280,
            maxWidth: '75vw',
          }}
          initialValues={{
            autoLogin: true,
          }}
          logo="https://gw.alipayobjects.com/zos/rmsportal/KDpgvguMpGfqaHPjicRK.svg"
          title={Settings.title}
          subTitle="AI 服务运营、监控与配置管理"
          onFinish={handleSubmit}
        >
          {errorMessage && <LoginMessage content={errorMessage} />}
          <ProFormText
            name="username"
            fieldProps={{
              size: 'large',
              prefix: <UserOutlined />,
            }}
            placeholder="用户名: admin"
            rules={[
              {
                required: true,
                message: '请输入用户名!',
              },
            ]}
          />
          <ProFormText.Password
            name="password"
            fieldProps={{
              size: 'large',
              prefix: <LockOutlined />,
            }}
            placeholder="密码: admin123"
            rules={[
              {
                required: true,
                message: '请输入密码!',
              },
            ]}
          />
        </LoginForm>
      </div>
      <Footer />
    </div>
  );
};

export default Login;
