import _ from "lodash";
import message from "./modules.chat/message";
// import server from "./modules/server";
// import pages from "./modules/pages";
// import uikit from "./modules/uikit";
import mesh from "./modules/mesh";
import AppLayout from '@/layout/AppLayout.vue';

const options = {
  routes: [
    {
      path: "/login",
      name: "Login",
			component: () => import('@/views/pages/auth/Login.vue')
    },
    {
      path: "/:pathMatch(.*)",
      name: "404",
			component: () => import('@/views/pages/NotFound.vue')
    },
    {
      path: "/403",
      name: "403",
			component: () => import('@/views/pages/auth/Access.vue')
    },
		{
		    path: '/error',
		    name: 'error',
		    component: () => import('@/views/pages/auth/Error.vue')
		},
		
		// {
		//   path: "/landing",
		//   name: "landing",
		// 	component: () => import('@/views/pages/Landing.vue')
		// },
		{
		    path: '/root',
		    name: 'Root',
		    component: () => import('@/layout/AppRoot.vue')
		},
    {
        path: '/',
        component: AppLayout,
				redirect: "/root",
        children: [
					mesh,
					message,
					{
							path: '/workplace',
							name: 'Workplace',
							component: () => import('@/views.chat/Workplace.vue')
					},
					// server,
					// pages,
					// uikit
				]
    },
  ],
};

options.initRoutes = _.cloneDeep(options.routes);
export default options;
