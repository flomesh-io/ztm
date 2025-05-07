const main = {
  path: "main",
  name: "Main",
	redirect: "/main",
  children: [
		{
				path: '/main',
				name: 'tunnels',
				component: () => import('../views/Main.vue')
		},
  ],
};

export default main;
