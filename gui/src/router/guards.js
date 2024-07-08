import { hasAuthority } from "@/service/common/authority-utils";
import { loginIgnore } from "@/router/index";
import { checkAuthorization, spread, merge } from "@/service/common/request";
import PipyProxyService from '@/service/PipyProxyService';
import NProgress from "nprogress";
import "nprogress/nprogress.css";
import { useToast } from "primevue/usetoast";
import { getCurrent, LogicalSize } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { platform } from '@tauri-apps/plugin-os';
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

const resize = (width,height,resizable) => {
	if(!!window.__TAURI_INTERNALS__ && getCurrent().setSize){
		const label = window.__TAURI_INTERNALS__.metadata.currentWindow.label;
		// getCurrent().setSize(new LogicalSize(width, height));
		invoke('plugin:window|set_size', {
		    label,
		    value: {
					'Logical': {width,height}
				}
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
  const { toast } = options;
	const store = useStore();
  if (!loginIgnore.includes(to) && !checkAuthorization()) {
		const toast = useToast();
		toast.add({ severity: 'warn', summary: 'Tips', detail: 'Login is invalid, please login again', life: 3000 });
		store.commit('account/setRedirect', to.path);
		resize(408,455,false);
    next({ path: "/login" });
  } else if(to.path == "/login"){
		resize(408,455,false);
    next();
  } else if(to.path == "/root"){
		if(!!window.__TAURI_INTERNALS__ ){
			platform().then((pm)=>{
				if(pm != "android"){
					resize(455,350,false);
					next();
				}else {
					next("/mesh/list");
				}
			});
		} else {
			next("/mesh/list");
		}
  } else {
		
		if(to.path.indexOf("/app") == -1){
			resize(1280,860,true);
		}
		// if(to.path != "/"){
		// 	const _meshes = store.getters['account/meshes']
		// 	if(!!_meshes && _meshes.length>0){
		// 		next();
		// 	} else {
		// 		pipyProxyService.getMeshes()
		// 			.then(res => {
		// 				next();
		// 				store.commit('account/setMeshes', res);
		// 			})
		// 			.catch(err => console.log('Request Failed', err)); 
		// 	}
		// } else {
		next();
		// }
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
