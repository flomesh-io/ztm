import { request, merge, spread } from '@/service/common/request';
import toast from "@/utils/toast";
import confirm from "@/utils/confirm";
import ZtmService from '@/service/ZtmService';
const ztmService = new ZtmService();
export default class ProxyService {
	getInfo() {
		return request(`/api/appinfo`);
	}
	getGroups() {
		const	_mesh = ztmService.getAppMesh()
		return request(`/api/meshes/${_mesh}/apps/ztm/users/api/groups`);
	}
	getUsers() {
		return request(`/api/users`);
	}
	getEndpoints(mesh,params) {
		return ztmService.getEndpoints(mesh,params);
	}
	getProxy(ep) {
		return request(`/api/endpoints/${ep}/config`)
	}
	setProxy({ep, listen, targets, exclusions, rules}) {
		const body = {};
		if(!!rules && rules.length>0){
			body.rules = rules
		}
		if(!!listen){
			body.listen = listen
		}
		const _targets = !!targets?targets.filter((t)=>!!t):[];
		if(_targets.length > 0){
			body.targets = _targets
		}
		const _exclusions = !!exclusions?exclusions.filter((t)=>!!t):[];
		if(_exclusions.length > 0){
			body.exclusions = _exclusions
		}
		return request(`/api/endpoints/${ep}/config`,"POST", body)
	}
}
