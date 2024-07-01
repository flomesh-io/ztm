import _ from "lodash";
import broswer from "./modules/broswer";
import AppLayout from '../layout/AppLayout.vue';

const options = {
  routes: [
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
    {
        path: '/',
        component: AppLayout,
				redirect: "/home",
        children: [
					broswer
				]
    },
  ],
};

options.initRoutes = _.cloneDeep(options.routes);
export default options;
