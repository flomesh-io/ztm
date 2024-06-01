import { createRouter, createWebHashHistory } from 'vue-router';
import { isAdmin } from "@/service/common/authority-utils";
import baseOptions from '@/router/config';
import chatOptions from '@/router/config.chat';

const loginIgnore = {
  names: ["404", "403", "Login", "Root"],
  paths: ["/login","/root"],
  includes(route) {
    return this.names.includes(route.name) || this.paths.includes(route.path);
  },
};

function resetRoutes(router, store) {
	const options = import.meta.env.VITE_APP_MODE=='chat' ? chatOptions : baseOptions;
	if(!!router){
		const oldRoutes = router.getRoutes();
		oldRoutes.forEach((oldRoute) => {
		  router.removeRoute(oldRoute.name);
		});
		options.routes.forEach((newRoute) => {
			router.addRoute(newRoute);
		});
	}
	return options;
}

async function initRouter({ store }) {
	const options = resetRoutes(null, store);
  // options.history = createWebHistory(process.env.VUE_APP_PUBLIC_PATH);
  options.history = createWebHashHistory();
  return createRouter(options);
}

export { loginIgnore, initRouter, resetRoutes };
