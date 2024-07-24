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
		const _targets = [];
		targets.forEach((target) => {
			const _target = {}
			if(!!target){
				if(target.indexOf(":")>=0){
					if(!!target.split(":")[0]){
						_target.host = target.split(":")[0]
					}
					if(!!target.split(":")[1]){
						_target.port = target.split(":")[1]*1
					}
					_targets.push(_target);
				} else {
					_targets.push({host:'127.0.0.1',port:target})
				}
			}
		})
		return request(`/api/endpoints/${ep}/outbound/${proto}/${name}`,"POST", {
			targets: _targets, entrances
		});
	}
	deleteOutbound({ep, proto, name}, callback) {
		confirm.remove(() => {
			request(`/api/endpoints/${ep}/outbound/${proto}/${name}`,"DELETE").then((res) => {
				toast.add({ severity: 'success', summary: 'Tips', detail: "Deleted", life: 3000 });
				if(!!callback)
				callback(res);
			}).catch(err => {
				if(!!callback)
				callback(err);
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
		const _listens = [];
		listens.forEach((listen) => {
			if(!!listen?.value){
				if(listen.value.indexOf(":")>=0){
					const _listen = { ip:listen.value.split(":")[0] }
					if(!_listen.ip){
						_listen.ip = "127.0.0.1"
					}
					if(!!listen.value.split(":")[1]){
						_listen.port = listen.value.split(":")[1]*1
					}
					_listens.push(_listen);
				} else {
					_listens.push({ip:'127.0.0.1',port:listen.value})
				}
			}
		})
		return request(`/api/endpoints/${ep}/inbound/${proto}/${name}`,"POST", {
			listens: _listens, exits
		});
	}
	getTunnels(callback) {
		this.getEndpoints().then((eps)=>{
			let reqs = [];
			// merge request
			(eps||[]).forEach((ep)=>{
				const outboundReq = this.getOutbounds(ep?.id).then((res)=> {
					return { data:res, ep, type:'outbound' }
				})
				reqs.push(outboundReq);
				const inboundReq = this.getInbounds(ep?.id).then((res)=> {
					return { data:res, ep, type:'inbound' }
				})
				reqs.push(inboundReq)
			})
			return merge(reqs).then((allRes) => {
				const tunnels = {};
				// set tunnels
				(allRes||[]).forEach((childres)=>{
					if(!!childres.data ){
						childres.data.forEach((res)=>{
							if(!!res.protocol && !!res.name){
								const _key = `${res.protocol}/${res.name}`
								if(!tunnels[_key]){
									tunnels[_key] = {
										name: res.name,
										proto: res.protocol,
										outbounds: [],
										inbounds: [],
									}
								}
								if(childres.type == "inbound"){
									const listens = [];
									if(!!res.listens){
										res.listens.forEach((listen)=>{
											listens.push({
												...listen,
												value:`${listen.ip}${!!listen.port?(':'+listen.port):''}`,
											})
										})
									}
									tunnels[_key].inbounds.push({
										...res,
										listens,
										ep:childres.ep
									})
								}else{
									const targets = [] 
									if(!!res.targets){
										res.targets.forEach((target)=>{
											targets.push(`${target.host}${!!target.port?(':'+target.port):''}`)
										})
									}
									tunnels[_key].outbounds.push({
										...res,
										targets,
										ep:childres.ep
									})
								}
							}
						})
					}
				})
				if(!!callback)
				callback(Object.values(tunnels),eps||[])
			})
		})
	}
	deleteInbound({ep, proto, name}, callback) {
		confirm.remove(() => {
			request(`/api/endpoints/${ep}/inbound/${proto}/${name}`,"DELETE").then((res) => {
				toast.add({ severity: 'success', summary: 'Tips', detail: "Deleted", life: 3000 });
				if(!!callback)
				callback(res);
			}).catch(err => {
				if(!!callback)
				callback(err);
			});
		})
	}
}
