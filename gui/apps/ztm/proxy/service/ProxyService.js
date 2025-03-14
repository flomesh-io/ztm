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
		return request(`/api/groups`);
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
	setProxy({ep, listen, targets, allow, deny, exclusions, rules}) {
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
		const _allow = !!allow?allow.filter((t)=>!!t):[];
		if(_allow.length > 0){
			body.allow = _allow
		}
		const _deny = !!deny?deny.filter((t)=>!!t):[];
		if(_deny.length > 0){
			body.deny = _deny
		}
		return request(`/api/endpoints/${ep}/config`,"POST", body)
	}
}
