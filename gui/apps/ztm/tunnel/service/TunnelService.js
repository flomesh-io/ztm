import { request, merge, spread } from '@/service/common/request';
import toast from "@/utils/toast";
import confirm from "@/utils/confirm";
export default class TunnelService {
	getInfo() {
		return request(`/api/appinfo`);
	}
	getEndpoints() {
		return request(`/api/endpoints`);
	}
	getOutbounds(ep) {
		return request(`/api/endpoints/${ep}/outbound`)
	}
	getOutbound({ep, proto, name}) {
		return request(`/api/endpoints/${ep}/outbound/${proto}/${name}`);
	}
	createOutbound({ep, proto, name, targets, entrances}) {
		return request(`/api/endpoints/${ep}/outbound/${proto}/${name}`,"POST", {
			targets, entrances
		});
	}
	deleteOutbound({ep, proto, name}, callback) {
		confirm.remove(() => {
			request(`/api/endpoints/${ep}/outbound/${proto}/${name}`,"DELETE").then((res) => {
				toast.add({ severity: 'success', summary: 'Tips', detail: "Deleted", life: 3000 });
				!!callback && callback(res);
			}).catch(err => {
				!!callback && callback(res);
			});
		})
	}
	getInbounds(ep) {
		return request(`/api/endpoints/${ep}/inbound`)
	}
	getInbound({ep, proto, name}) {
		return request(`/api/endpoints/${ep}/inbound/${proto}/${name}`);
	}
	createInbound({ep, proto, name, listens, exits}) {
		return request(`/api/endpoints/${ep}/inbound/${proto}/${name}`,"POST", {
			listens, exits
		});
	}
	getTunnels(callback) {
		this.getEndpoints().then((eps)=>{
			let reqs = [];
			eps.forEach((ep)=>{
				const outboundReq = this.getOutbounds(ep?.id).then((res)=> {
					return { data:res, ep, type:'outbound' }
				})
				reqs.push(outboundReq);
				const inboundReq = this.getInbounds(ep?.id).then((res)=> {
					return { data:res, ep, type:'inbound' }
				})
				reqs.push(inboundReq)
			})
			return merge(_reqs).then((allRes) => {
				const tunnels = {};
				allRes.forEach((res)=>{
					if(!!res.data && !!res.data.proto && !!res.data.name){
						const _key = `${res.data.proto}/${res.data.name}`
						if(&& !tunnels[_key]){
							tunnels[_key] = {
								name: res.data.name,
								proto: res.data.proto,
								outbounds: [],
								inbounds: [],
							}
						}
						if(res.type == "inbound"){
							tunnels[_key].inbounds.push(res)
						}else{
							tunnels[_key].outbounds.push(res)
						}
					}
				})
				callback(Object.values(tunnels))
			})
		})
	}
	deleteInbound({ep, proto, name}) {
		confirm.remove(() => {
			request(`/api/endpoints/${ep}/inbound/${proto}/${name}`,"DELETE").then((res) => {
				toast.add({ severity: 'success', summary: 'Tips', detail: "Deleted", life: 3000 });
				!!callback && callback(res);
			}).catch(err => {
				!!callback && callback(res);
			});
		})
	}
}
