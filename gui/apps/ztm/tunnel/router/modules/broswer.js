const broswer = {
  path: "broswer",
  name: "Broswer",
	redirect: "/home",
  children: [
		{
				path: '/home',
				name: 'tunnels',
				component: () => import('../../views/Main.vue')
		},
  ],
};

export default broswer;
