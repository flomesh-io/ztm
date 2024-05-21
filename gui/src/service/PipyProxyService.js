import { request } from './common/request';
import toast from "@/utils/toast";
import confirm from "@/utils/confirm";
const isDev = process.env.NODE_ENV === "development";
export default class PipyProxyService {
	login(user, password) {
		return request('/api/login', "POST", {
			user, password
		});
	}
	clients() {
		return request('/users');
	}
	query({id, sql}) {
		return request('/api',"POST",sql);
	}
	os({id, sql}) {
		return request('/os',"POST",sql);
	}
	info({id}) {
		return request('/api/info');
	}
	getCa({id}) {
		return request('/api/get-ca');
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
	downloadCa({id}) {
		return '/api/download-ca';
	}
	renewCa({id, organization, commonName}) {
		return request('/api/renew-ca',"POST",{
			organization, commonName
		});
	}
	getConfig({id}) {
		return request('/api/get-config');
	}
	saveConfig({id, config}) {
		return request('/api/save-config',"POST",config);
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
