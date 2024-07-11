import { request } from './common/request';
import toast from "@/utils/toast";
import confirm from "@/utils/confirm";
export default class TunnelService {
	getEndpoints(mesh) {
		return request(`/api/meshes/${mesh}/endpoints`);
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
	getPorts({
		mesh,
		ep
	}) {
		return request(`/api/meshes/${mesh}/endpoints/${ep}/ports`);
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
}
