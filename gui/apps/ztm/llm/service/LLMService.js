import { request,requestWithTimeout, merge, spread } from '@/service/common/request';
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
	getServices(ep) {
		return ep?request(`/api/endpoints/${ep}/services`):request(`/api/services`);
	}
	/*
		protocol: 'openai' | 'mcp',
		metainfo: 
			version: string
			provider: string
			description: string
		target:
			address: <URL> | <pathname>
			headers:
				Authorization: Bearer <apikey>
			body: （default to route body）
				model: Pro/deepseek-ai/DeepSeek-V3,
				...
			...(other configurations)
	*/
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
	createRoute({ep, path, service}) {
		return request(`/api/endpoints/${ep}/routes/${path}`,"POST", { service });
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
}
