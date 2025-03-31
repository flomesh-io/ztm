const mesh = {
  path: "mesh",
  name: "Mesh",
	redirect: "/mesh/list",
  children: [
		{
				path: '/mesh/list',
				name: 'meshes',
				component: () => import('@/views/mesh/Meshes.vue')
		},
		{
				path: '/mesh/endpoints',
				name: 'endpoints',
				component: () => import('@/views/mesh/Endpoints.vue')
		},
		{
				path: '/mesh/apps',
				name: 'apps',
				component: () => import('@/views/apps/AppStore.vue')
		},
		{
				path: '/mesh/app/:provider/:name',
				name: 'app',
				component: () => import('@/views/apps/AppStore.vue')
		},
		{
				path: '/mesh/log',
				name: 'ep log',
				component: () => import('@/views/log/EpLog.vue')
		},
		{
				path: '/mesh/cloud',
				name: 'cloud',
				component: () => import('@/views/chat/Main.vue')
		},
		{
				path: '/mesh/chat',
				name: 'chat',
				component: () => import('@/views/chat/Main.vue')
		},
  ],
};

export default mesh;
