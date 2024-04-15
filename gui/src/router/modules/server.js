const server = {
  path: "server",
  name: "Server",
	redirect: "/server/clients",
  children: [
		{
				path: '/server/clients',
				name: 'clients',
				component: () => import('@/views/server/Clients.vue')
		},
		{
				path: '/server/backends',
				name: 'backends',
				component: () => import('@/views/server/Backends.vue')
		},
		{
				path: '/server/hostinfo/:id',
				name: 'server hostinfo',
				component: () => import('@/views/client/Hostinfo.vue')
		},
		{
				path: '/server/network/:id',
				name: 'server network',
				component: () => import('@/views/client/Network.vue')
		},
		{
				path: '/server/testtool/:id',
				name: 'server testtool',
				component: () => import('@/views/client/Testtool.vue')
		},
		{
				path: '/server/config/:id',
				name: 'server config',
				component: () => import('@/views/client/Config.vue')
		},
		{
				path: '/server/database',
				name: 'database',
				component: () => import('@/views/server/Database.vue')
		},
  ],
};

export default server;
