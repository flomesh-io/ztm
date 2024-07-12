import _ from "lodash";
import tunnel from "./modules/tunnel";
import EmptyLayout from '../../../common/layout/EmptyLayout.vue';

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
        component: EmptyLayout,
				redirect: "/main",
        children: [
					tunnel
				]
    },
  ],
};

options.initRoutes = _.cloneDeep(options.routes);
export default options;
