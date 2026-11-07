export default [
  {
    path: '/user',
    layout: false,
    routes: [
      {
        path: '/user/login',
        name: 'login',
        component: './user/login',
      },
      {
        path: '/user',
        redirect: '/user/login',
      },
      {
        name: '404',
        component: './exception/404',
        path: '/user/*',
      },
    ],
  },
  {
    path: '/docs',
    name: 'docs',
    icon: 'fileText',
    component: './docs',
  },
  {
    path: '/docs/:id',
    name: 'docs.editor',
    icon: 'edit',
    component: './docs/editor',
    hideInMenu: true,
  },
  {
    path: '/',
    redirect: '/docs',
  },
  {
    component: './exception/404',
    path: '*',
  },
];
