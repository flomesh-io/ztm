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
  ],
};

export default app;
