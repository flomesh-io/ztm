import { hasAuthority } from "@/service/common/authority-utils";
import { loginIgnore } from "@/router/index";
import { checkAuthorization, spread, merge } from "@/service/common/request";
import PipyProxyService from '@/service/PipyProxyService';
import NProgress from "nprogress";
import "nprogress/nprogress.css";
import { useToast } from "primevue/usetoast";
import { useStore } from 'vuex';
NProgress.configure({ showSpinner: true });

const pipyProxyService = new PipyProxyService();


/**
 * Progress Start
 * @param to
 * @param form
 * @param next
 */
const progressStart = (to, from, next) => {
  // start progress bar
  if (!NProgress.isStarted()) {
    NProgress.start();
  }
  next();
};

/**
 * Login Guard
 * @param to
 * @param form
 * @param next
 * @param options
 */
const loginGuard = (to, from, next, options) => {
  const { toast } = options;
	const store = useStore();
  if (!loginIgnore.includes(to) && !checkAuthorization()) {
		const toast = useToast();
		toast.add({ severity: 'warn', summary: 'Tips', detail: 'Login is invalid, please login again', life: 3000 });
		store.commit('account/setRedirect', to.path);
    next({ path: "/login" });
  } else if(to.path == "/login"){
    next();
  } else if(to.path == "/root"){
		if(!!window.__TAURI_INTERNALS__ ){
			platform().then((pm)=>{
				if(pm != "android"){
					next();
				}else {
					next("/mesh/list");
				}
			});
		} else {
			next("/mesh/list");
		}
  } else {
		const test = false;
		if(to.path != "/"){
			const _meshes = store.getters['account/meshes']
			if(!!_meshes && _meshes.length>0){
				next();
			} else {
				pipyProxyService.getMeshes()
					.then(res => {
						next();
						store.commit('account/setMeshes', res);
					})
					.catch(err => console.log('Request Failed', err)); 
			}
		} else {
			next();
		}
	}
};

/**
 * Progress Done
 * @param to
 * @param form
 * @param options
 */
const progressDone = () => {
  // finish progress bar
  NProgress.done();
};

export default {
  beforeEach: [
    progressStart,
    loginGuard,
  ],
  afterEach: [progressDone],
};
