const broswer = {
  path: "broswer",
  name: "Broswer",
	redirect: "/home",
  children: [
		{
				path: '/home',
				name: 'endpoints',
				component: () => import('@/views/mesh/Endpoints.vue')
		},
  ],
};

export default broswer;
