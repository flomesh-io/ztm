const store = {
  path: "store",
  name: "store",
	redirect: "/store/apps",
  children: [
		{
				path: '/store/apps',
				name: 'app store',
				component: () => import('@/views/apps/AppStore.vue')
		},
  ],
};

export default store;
