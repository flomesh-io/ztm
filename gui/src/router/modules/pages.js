const pages = {
  path: "page",
  name: "Pages",
	redirect: "/page/dashboard",
  children: [
    {
        path: '/page/dashboard',
        name: 'dashboard',
        component: () => import('@/views/Dashboard.vue')
    },
		{
				path: '/page/backends',
				name: 'page backends',
				component: () => import('@/views/server/Backends.vue')
		},
    {
        path: '/page/blocks',
        name: 'blocks',
        component: () => import('@/views/utilities/Blocks.vue')
    },
    {
        path: '/page/icons',
        name: 'icons',
        component: () => import('@/views/utilities/Icons.vue')
    },
    {
        path: '/page/timeline',
        name: 'timeline',
        component: () => import('@/views/pages/Timeline.vue')
    },
    {
        path: '/page/empty',
        name: 'empty',
        component: () => import('@/views/pages/Empty.vue')
    },
    {
        path: '/page/crud',
        name: 'crud',
        component: () => import('@/views/pages/Crud.vue')
    }
    
  ],
};

export default pages;
