const app = {
  path: "/app",
  name: "Apps",
  children: [
		{
				path: '/app/term',
				name: 'Rerm',
				component: () => import('@/views/apps/core/TermContent.vue')
		},
		{
				path: '/app/ztmlog',
				name: 'ZTM Log',
				component: () => import('@/views/apps/core/ZtmLog.vue')
		},
		
		{
				path: '/app/log/:mesh/:ep/:provider/:app',
				name: 'app log',
				component: () => import('@/views/log/AppLog.vue')
		},
  ],
};

export default app;
