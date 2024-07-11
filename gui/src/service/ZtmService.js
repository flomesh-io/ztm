import { request } from './common/request';
import toast from "@/utils/toast";
import confirm from "@/utils/confirm";
export default class ZtmService {
	login(user, password) {
		return request('/api/login', "POST", {
			user, password
		});
	}
	info({id}) {
		return request('/api/info');
	}
	getMeshes() {
		return request('/api/meshes');
	}
	getMesh(name) {
		return request(`/api/meshes/${name}`);
	}
	joinMesh(name, config) {
		if(config.bootstraps){
			config.bootstraps = config.bootstraps.filter(n=>!!n)
		}
		return request(`/api/meshes/${name}`,"POST",config);
	}
	getServices({
		mesh,
		ep
	}) {
		if(!!ep){
			return request(`/api/meshes/${mesh}/endpoints/${ep}/services`);
		} else {
			return request(`/api/meshes/${mesh}/services`);
		}
	}
	getService({
		mesh,
		name,
		proto,
		ep,
	}) {
		return request(`/api/meshes/${mesh}/endpoints/${ep}/services/${proto}/${name}`);
	}
	createService({
		mesh,
		ep,
		name, 
		proto,
		port,
		host,
		users
	}) {
		return request(`/api/meshes/${mesh}/endpoints/${ep}/services/${proto}/${name}`,"POST", {
			port, host, users:users?users.filter(n=>!!n):null
		});
	}
	getPorts({
		mesh,
		ep
	}) {
		return request(`/api/meshes/${mesh}/endpoints/${ep}/ports`);
	}
	getLogs(mesh, ep) {
		return request(`/api/meshes/${mesh}/endpoints/${ep}/log`);
	}
	getEndpoints(mesh) {
		return request(`/api/meshes/${mesh}/endpoints`);
	}
	getVersion() {
		return request(`/api/version`);
	}
	createPort({
		mesh,
		ep,
		proto,
		ip,
		port,
		body
	}) {
		return request(`/api/meshes/${mesh}/endpoints/${ep}/ports/${ip}/${proto}/${port}`,"POST", body);
	}
	deletePort({
		mesh,
		ep,
		proto,
		ip,
		port,
	},callback) {
		
		confirm.remove(() => {
			request(`/api/meshes/${mesh}/endpoints/${ep}/ports/${ip}/${proto}/${port}`,"DELETE").then((res) => {
				toast.add({ severity: 'success', summary: 'Tips', detail: "Deleted", life: 3000 });
				!!callback && callback(res);
			}).catch(err => {
				!!callback && callback(res);
			});
		})
	}
	deleteMesh(name,callback) {
		confirm.remove(() => {
			request(`/api/meshes/${name}`,"DELETE").then((res) => {
				toast.add({ severity: 'success', summary: 'Tips', detail: "Deleted", life: 3000 });
				!!callback && callback(res);
			}).catch(err => {
				!!callback && callback(res);
			});
		});
	}
	deleteService({
		mesh,
		ep,
		name, 
		proto,
	},callback) {
		confirm.remove(() => {
			request(`/api/meshes/${mesh}/endpoints/${ep}/services/${proto}/${name}`,"DELETE").then((res) => {
				toast.add({ severity: 'success', summary: 'Tips', detail: "Deleted", life: 3000 });
				!!callback && callback(res);
			}).catch(err => {
				!!callback && callback(res);
			});
		});
	}
	getBackend() {
		return request('/get-backend-config');
	}
	saveBackend(config) {
		return request('/set-backend-config',"POST",config);
	}
	invoke({
		id,
		config
	}) {
		return request('/api/invoke',"POST",config);
	}
}
