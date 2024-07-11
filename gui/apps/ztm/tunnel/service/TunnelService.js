import { request, merge, spread } from '@/service/common/request';
import toast from "@/utils/toast";
import confirm from "@/utils/confirm";
export default class TunnelService {
	getEndpoints() {
		return request(`/api/endpoints`);
	}
	getOutbounds(ep) {
		return request(`/api/endpoints/${ep}/outbound`)
	}
	getOutbound({ep, proto, name}) {
		return request(`/api/endpoints/${ep}/outbound/${proto}/${name}`);
	}
	getAllOutbound(callback) {
		this.getEndpoints().then((eps)=>{
			let reqs = [];
			eps.forEach((ep)=>{
				reqs.push(this.getOutbound(ep?.id))
			})
			return merge(_reqs).then((allRes) => callback(allRes))
		})
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
