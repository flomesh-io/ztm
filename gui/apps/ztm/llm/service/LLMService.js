import { request,requestWithTimeout,getUrl, merge, spread } from '@/service/common/request';
import toast from "@/utils/toast";
import confirm from "@/utils/confirm";
import ZtmService from '@/service/ZtmService';
const ztmService = new ZtmService();
export default class LLMService {
	getInfo() {
		return request(`/api/appinfo`);
	}
	getEndpoints() {
		return ztmService.getEndpoints();
	}
	getSvcUrl(path){
		return getUrl(path,true);
	}
	getServices(ep) {
		return ep?request(`/api/endpoints/${ep}/services`):request(`/api/services`);
	}
	getService(ep, {kind, name}) {
		return request(`/api/endpoints/${ep}/services/${kind}/${name}`);
	}
	createService({ep, kind, name, body}) {
		const _body = body;
		delete _body.name;
		delete _body.kind;
		delete _body.endpoint;
		return request(`/api/endpoints/${ep}/services/${kind}/${name}`,"POST", _body);
	}
	
	deleteService({ep, kind, name}, callback) {
		confirm.remove(() => {
			request(`/api/endpoints/${ep}/services/${kind}/${name}`,"DELETE").then((res) => {
				toast.add({ severity: 'success', summary: 'Tips', detail: "Deleted", life: 3000 });
				if(!!callback)
				callback(res);
			}).catch(err => {
				if(!!callback)
				callback(err);
			});
		})
	}
	
	getRoutes(ep) {
		return request(`/api/endpoints/${ep}/routes`);
	}
	/*
	service: {
		name,
		kind,
		endpoint: {...},
		...
	}
	*/
	createRoute({ep, path, service, cors}) {
		return request(`/api/endpoints/${ep}/routes/${path}`,"POST", { service, cors });
	}
	
	deleteRoute({ep, path}, callback) {
		confirm.remove(() => {
			request(`/api/endpoints/${ep}/routes/${path}`,"DELETE").then((res) => {
				toast.add({ severity: 'success', summary: 'Tips', detail: "Deleted", life: 3000 });
				if(!!callback)
				callback(res);
			}).catch(err => {
				if(!!callback)
				callback(err);
			});
		},()=>{},'After removing the route, the ref service settings of your AI bot will become invalid and need to be reconfigured')
	}
	deleteRouteNoConfirm(ep, routes) {
		const reqs = [];
		routes.forEach((r)=>{
			reqs.push(request(`/api/endpoints/${ep}/routes/${r.path}`,"DELETE"))
		})
		return merge(reqs)
	}
}
