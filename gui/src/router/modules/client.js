const client = {
  path: "client",
  name: "Client",
	redirect: "/client/hub/list",
  children: [
		{
				path: '/client/network',
				name: 'network',
				component: () => import('@/views/client/Network.vue')
		},
		{
				path: '/client/hostinfo',
				name: 'hostinfo',
				component: () => import('@/views/client/Hostinfo.vue')
		},
		{
				path: '/client/testtool',
				name: 'testtool',
				component: () => import('@/views/client/Testtool.vue')
		},
		{
				path: '/client/config',
				name: 'config',
				component: () => import('@/views/client/Config.vue')
		},
		{
				path: '/client/documentation',
				name: 'documentation',
				component: () => import('@/views/client/Documentation.vue')
		},
  ],
};

export default client;
