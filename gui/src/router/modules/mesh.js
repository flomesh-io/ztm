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
				path: '/mesh/log',
				name: 'log',
				component: () => import('@/views/mesh/Log.vue')
		},
  ],
};

export default mesh;
