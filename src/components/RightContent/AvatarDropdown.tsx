import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { history, useModel } from '@umijs/max';
import type { MenuProps } from 'antd';
import React, { startTransition } from 'react';
import HeaderDropdown from '../HeaderDropdown';

type GlobalHeaderRightProps = {
  children?: React.ReactNode;
};

const menuItems: MenuProps['items'] = [
  {
    key: 'logout',
    icon: <LogoutOutlined />,
    label: '退出登录',
  },
];

const loginOut = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  const { search, pathname } = window.location;
  const searchParams = new URLSearchParams({
    redirect: pathname + search,
  });
  const urlParams = new URL(window.location.href).searchParams;
  const redirect = urlParams.get('redirect');
  if (window.location.pathname !== '/user/login' && !redirect) {
    history.replace({
      pathname: '/user/login',
      search: searchParams.toString(),
    });
  }
};

export const AvatarDropdown: React.FC<GlobalHeaderRightProps> = ({
  children,
}) => {
  const { initialState, setInitialState } = useModel('@@initialState');

  const onMenuClick: MenuProps['onClick'] = (event) => {
    const { key } = event;
    if (key === 'logout') {
      startTransition(() => {
        setInitialState((s) => ({ ...s, currentUser: undefined }));
      });
      loginOut();
    }
  };

  if (!initialState?.currentUser) {
    return (
      <span className={`${'anticon'} ${'anticon-spin'} anticon-user`}>
        <UserOutlined />
      </span>
    );
  }

  return (
    <HeaderDropdown
      placement="bottomRight"
      menu={{
        selectedKeys: [],
        onClick: onMenuClick,
        items: menuItems,
      }}
      arrow
    >
      {children}
    </HeaderDropdown>
  );
};
