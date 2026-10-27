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
    path: '/dashboard',
    name: 'dashboard',
    icon: 'dashboard',
    component: './dashboard',
  },
  {
    path: '/calendar',
    name: 'calendar',
    icon: 'calendar',
    component: './calendar',
  },
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    component: './exception/404',
    path: '*',
  },
];
