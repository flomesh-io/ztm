import { request,requestWithTimeout, merge, spread } from '@/service/common/request';
import toast from "@/utils/toast";
import confirm from "@/utils/confirm";
import ZtmService from '@/service/ZtmService';
const ztmService = new ZtmService();
export default class TunnelService {
	getInfo() {
		return request(`/api/appinfo`);
	}
	getEndpoints() {
		return ztmService.getEndpoints();
	}
	getInbounds(ep) {
		return requestWithTimeout(3000, `/api/endpoints/${ep}/inbound`)
	}
	getInbound({ep, protocol, name}) {
		return request(`/api/endpoints/${ep}/inbound/${protocol}/${name}`);
	}
	getOutbounds(ep) {
		return requestWithTimeout(3000, `/api/endpoints/${ep}/outbound`)
	}
	getOutbound({ep, protocol, name}) {
		return request(`/api/endpoints/${ep}/outbound/${protocol}/${name}`);
	}
	createOutbound({ep, protocol, name, targets, entrances, users}) {
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
					_targets.push({host:'127.0.0.1',port:target*1})
				}
			}
		})
		return request(`/api/endpoints/${ep}/outbound/${protocol}/${name}`,"POST", {
			targets: _targets, entrances, users: users||[]
		});
	}
	deleteOutbound({ep, protocol, name}, callback) {
		confirm.remove(() => {
			request(`/api/endpoints/${ep}/outbound/${protocol}/${name}`,"DELETE").then((res) => {
				toast.add({ severity: 'success', summary: 'Tips', detail: "Deleted", life: 3000 });
				if(!!callback)
				callback(res);
			}).catch(err => {
				if(!!callback)
				callback(err);
			});
		})
	}
	createInbound({ep, protocol, name, listens, exits}) {
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
					_listens.push({ip:'127.0.0.1',port:listen.value*1})
				}
			}
		})
		return request(`/api/endpoints/${ep}/inbound/${protocol}/${name}`,"POST", {
			listens: _listens, exits
		});
	}
	getTunnels() {
		return request(`/api/tunnels`);
	}
	getTunnel(d) {
		let reqs = [];
		// merge request
		d.outbound.forEach((ep)=>{
			const outboundReq = this.getOutbound({ep:ep?.id, protocol: d.protocol, name: d.name}).then((res)=> {
				return { data:res, ep, type:'outbound' }
			}).catch((e)=>{
			})
			reqs.push(outboundReq);
		})
			
			
		d.inbound.forEach((ep)=>{
			const inboundReq = this.getInbound({ep:ep?.id, protocol: d.protocol, name: d.name}).then((res)=> {
				return { data:res, ep, type:'inbound' }
			}).catch((e)=>{
			})
			reqs.push(inboundReq)
		})
		
		return merge(reqs).then((allRes) => {
			const tunnel = {
				...d,
				inbounds:[],
				outbounds:[],
			};
			(allRes||[]).forEach((childres)=>{
				if(!!childres?.data ){
					let res = childres.data
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
						tunnel.inbounds.push({
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
						tunnel.outbounds.push({
							...res,
							targets,
							ep:childres.ep
						})
					}
				}
			})
			return tunnel
		})
	}
	deleteInbound({ep, protocol, name}, callback) {
		confirm.remove(() => {
			request(`/api/endpoints/${ep}/inbound/${protocol}/${name}`,"DELETE").then((res) => {
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
