import { hasAuthority } from "@/service/common/authority-utils";
import { loginIgnore } from "@/router/index";
import { checkAuthorization, spread, merge } from "@/service/common/request";
import PipyProxyService from '@/service/PipyProxyService';
import NProgress from "nprogress";
import "nprogress/nprogress.css";
import { useToast } from "primevue/usetoast";
import { getCurrent, LogicalSize } from '@tauri-apps/api/window';
import store from "@/store";
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

const resize = (width,height,resizable) => {
	if(!!window.__TAURI_INTERNALS__ && getCurrent().setSize){
		getCurrent().setSize({
			type:'Logical',
			width,
			height
		});
	}
	if(!!window.__TAURI_INTERNALS__ && getCurrent().setResizable){
		getCurrent().setResizable(resizable);
	}
}
/**
 * Login Guard
 * @param to
 * @param form
 * @param next
 * @param options
 */
const loginGuard = (to, from, next, options) => {
	const $store = options.store;
  const { toast } = options;
  if (!loginIgnore.includes(to) && !checkAuthorization()) {
		const toast = useToast();
		toast.add({ severity: 'warn', summary: 'Tips', detail: 'Login is invalid, please login again', life: 3000 });
		$store.commit('account/setRedirect', to.path);
		resize(408,455,false);
    next({ path: "/login" });
  } else if(to.path == "/login"){
		resize(408,455,false);
    next();
  } else if(to.path == "/root"){
		if(!!window.__TAURI_INTERNALS__){
			resize(455,350,false);
			next();
		} else {
			next("/mesh/list");
		}
  } else {
		resize(1280,860,true);
		if(to.path != "/mesh/list" && to.path != "/"){
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
