const app = {
  path: "/app",
  name: "Apps",
  children: [
		{
				path: '/app/term',
				name: 'term',
				component: () => import('@/views/apps/core/TermContent.vue')
		},
		{
				path: '/app/ztmlog',
				name: 'ztm log',
				component: () => import('@/views/apps/core/ZtmLog.vue')
		},
  ],
};

export default app;
