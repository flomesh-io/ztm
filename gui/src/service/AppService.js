import { request,requestNM,getUrl,merge } from './common/request';
import toast from "@/utils/toast";
import confirm from "@/utils/confirm";
import { openWebview } from '@/utils/webview';
import store from "@/store";
import ZtmService from '@/service/ZtmService';
const ztmService = new ZtmService();
export default class AppService {
	
	getTunnelEndpoints(mesh){
		const options = {
			mesh:mesh?.name,
			ep:mesh?.agent?.id,
			provider:'ztm',
			app:'tunnel',
		}
		const base = this.getAppUrl(options);
		return this.invokeAppApi({
			base,
			url:`/api/endpoints`,
			method: 'GET'
		})
	}
	
	getInbound({mesh, ep, proto, name}) {
	
		const options = {
			mesh:mesh?.name,
			ep:mesh?.agent?.id,
			provider:'ztm',
			app:'tunnel',
		}
		const base = this.getAppUrl(options);
		return this.invokeAppApi({
			base,
			url:`/api/endpoints/${ep}/inbound/${proto}/${name}`,
			method: 'GET'
		})
	}
	getOutbound({mesh, ep, proto, name}) {
		
		const options = {
			mesh:mesh?.name,
			ep:mesh?.agent?.id,
			provider:'ztm',
			app:'tunnel',
		}
		const base = this.getAppUrl(options);
		return this.invokeAppApi({
			base,
			url:`/api/endpoints/${ep}/outbound/${proto}/${name}`,
			method: 'GET'
		})
	}
	getTunnel({mesh, ep}) {
		let reqs = [];
		const tunnelName = `${mesh?.agent?.name}To${ep?.name}`;
		const outboundReq = this.getOutbound({
			mesh,
			ep:ep?.id,
			proto: 'tcp',
			name:tunnelName
		}).then((res)=> {
			return { data:res, ep, type:'outbound' }
		}).catch((e)=>{
		})
		reqs.push(outboundReq);
		const inboundReq = this.getInbound({
			mesh,
			ep:mesh?.agent?.id,
			proto: 'tcp',
			name:tunnelName
		}).then((res)=> {
			return { data:res, ep, type:'inbound' }
		}).catch((e)=>{
		})
		reqs.push(inboundReq);
		return reqs;
	}
	getTunnels({mesh, eps, callback, error}) {
		let reqs = [];
		// merge request
		(eps||[]).forEach((ep)=>{
			reqs = reqs.concat(this.getTunnel({
				mesh, ep
			}))
		})
		
		return merge(reqs).then((allRes) => {
			const tunnels = {};
			// set tunnels
			(allRes||[]).forEach((childres)=>{
				if(!!childres?.data ){
					const res = childres.data;
					if(!!res.protocol && !!res.name){
						const _key = childres.ep?.id;
						if(!tunnels[_key]){
							tunnels[_key] = {
								name: res.name,
								proto: res.protocol,
							}
						}
						tunnels[_key][childres.type] = res;
						tunnels[_key].starting = false;
						tunnels[_key].stoping = false;
					}
				}
			})
			if(!!callback)
			callback(tunnels,eps||[])
		}).catch(()=>{
			if(!!error)
			error()
		})
	}
	startRDPTunnel({
		mesh,
		ep,
		callback
	}) {
		const options = {
			mesh:mesh?.name,
			ep:mesh?.agent?.id,
			provider:'ztm',
			app:'tunnel',
		}
		const tunnelName = `${mesh?.agent?.name}To${ep?.name}`;
		const base = this.getAppUrl(options);
		this.invokeAppApi({
			base,
			url:`/api/endpoints/${ep?.id}/outbound/tcp/${tunnelName}`,
			method: 'POST',
			body: {
				targets: [{
					host:'127.0.0.1',
					port:3389
				}], 
				entrances:[mesh?.agent?.id]
			}
		}).then((resInbound)=>{
			this.invokeAppApi({
				base,
				url:`/api/endpoints/${mesh?.agent?.id}/inbound/tcp/${tunnelName}`,
				method: 'POST',
				body: {
					listens: [{
						ip:'127.0.0.1',
						port:13389
					}], 
					exits:[ep?.id]
				}
			}).then((resOutbound)=>{
				callback(resInbound,resOutbound)
			});
		})
	}
	
	stopRDPTunnel({
		mesh,
		ep,
	}) {
		const options = {
			mesh:mesh?.name,
			ep:mesh?.agent?.id,
			provider:'ztm',
			app:'tunnel',
		}
		const tunnelName = `${mesh?.agent?.name}To${ep?.name}`;
		const base = this.getAppUrl(options);
		const deleteReqs = [];
		deleteReqs.push(this.invokeAppApi({
			base,
			url:`/api/endpoints/${ep?.id}/outbound/tcp/${tunnelName}`,
			method: 'DELETE',
		}))
		deleteReqs.push(this.invokeAppApi({
			base,
			url:`/api/endpoints/${mesh?.agent?.id}/inbound/tcp/${tunnelName}`,
			method: 'DELETE',
		}));
		return merge(deleteReqs)
	}
	//
	// App
	//   name: string
	//   tag: string
	//   provider: string
	//   username: string
	//   isRunning: boolean
	//   isPublished: boolean
	//   log: string[]
	//
	getProxyListen(mesh) {
		const options = {
			mesh:mesh?.name,
			ep:mesh?.agent?.id,
			provider:'ztm',
			app:'proxy',
		}
		const base = this.getAppUrl(options);
		return this.invokeAppApi({
			base,
			url:`/api/endpoints/${mesh?.agent?.id}/config`,
			method: 'GET'
		})
	}
	getProxyOutbounds(mesh) {
		const options = {
			mesh:mesh?.name,
			ep:mesh?.agent?.id,
			provider:'ztm',
			app:'proxy',
		}
		const base = this.getAppUrl(options);
		let eps = localStorage.getItem("PROXY-EPS");
		eps = !!eps?eps.split(","):[];
		
		const reqs = []
		eps.forEach((ep)=>{
			const req = this.invokeAppApi({
				base,
				url:`/api/endpoints/${mesh?.agent?.id}/config`,
				method: 'GET',
			}).then((res)=> {
				return { targets:res.targets, ep,  }
			})
			reqs.push(req);
		})
		return merge(reqs);
	}
	setProxy({outbounds, listen, mesh},callback) {
		const options = {
			mesh:mesh?.name,
			ep:mesh?.agent?.id,
			provider:'ztm',
			app:'proxy',
		}
		const base = this.getAppUrl(options);
		// set local listen
		this.invokeAppApi({
			base,
			url:`/api/endpoints/${mesh?.agent?.id}/config`,
			method: 'POST',
			body:{ 
				listen
			}
		})
			.then(res => {
				console.log(res)
				const afterEps = [];
				
				const reqs = []
				outbounds.forEach((outbound)=>{
					afterEps.push(outbound.ep)
					if(!outbound.targets){
						outbound.targets = []
					}
					if(!outbound.targets || outbound.targets.length == 0){
						outbound.targets.push("*")
						outbound.targets.push("0.0.0.0/0")
					}
					const body = {
						targets: outbound.targets
					};
					if(outbound.ep == mesh?.agent?.id){
						body.listen = listen;
					}
					// set remote targets
					const req = this.invokeAppApi({
						base,
						url:`/api/endpoints/${outbound.ep}/config`,
						method: 'POST',
						body
					});
					reqs.push(req);
				})
				
				let beforeEps = localStorage.getItem("PROXY-EPS");
				beforeEps = !!beforeEps?beforeEps.split(","):[];
				const deleteEps = beforeEps.filter(ep => !afterEps.includes(ep));
				deleteEps.forEach((ep)=>{
					const body = {};
					if(outbound.ep == mesh?.agent?.id){
						body.listen = listen;
					}
					if(ep == mesh?.agent?.id){
						body.listen = listen;
					}
					const req = this.invokeAppApi({
						base,
						url:`/api/endpoints/${ep}/config`,
						method: 'POST',
						body
					});
					reqs.push(req);
				})
				merge(reqs).then(res => {
					if(!!callback){
						callback(res)
					}
					localStorage.setItem("PROXY-EPS",afterEps.join(","))
				})
				.catch(err1 => {
					console.log("set remote targets errors")
					console.log(err1)
				}); 
				
				
				
			})
			.catch(err3 => {
				console.log("set remote targets errors")
				console.log(err3)
			}); 
			
	}
	openbrowser({mesh, url, width, height, proxy, ep}) {
		if(proxy){
			this.getProxyListen(mesh).then((res)=>{
				if(!!res.listen){
					this.openWV(url, width, height, res.listen)
				} else {
					this.openWV(url, width, height);
				}
			});
		} else {
			this.openWV(url, width, height)
		}
		if(!!ep){
			this.setProxyOutbound({
				mesh,
				endpoint:ep
			})
		}
	}
	openWV(url, width, height , listen) {
		const webviewOptions = {
			url,
			name:url.replace(/.*\/\//,"").replaceAll("/","_").replaceAll(".","_").replaceAll("-","_"),
			width:width||1280,
			height:height||860,
			proxy: !!listen?`socks5://${listen}`:''
		}
		openWebview(webviewOptions)
	}
	invokeAppApi({
		base,
		url,
		method,
		body
	}){
		if(!!body){
			return request(`${base}${url}`, method, body);
		}else{
			return request(`${base}${url}`, method);
		}
	}
	getApps(mesh) {
		return request(`/api/meshes/${mesh}/apps`);
	}
	getEpApps(mesh, ep) {
		return request(`/api/meshes/${mesh}/endpoints/${ep}/apps`);
	}
	getAppUrl({
		mesh, provider, app
	}) {
		return getUrl(`/api/meshes/${mesh}/apps/${provider}/${app}`);
	}
	getApp({
		mesh, ep, provider, app
	}) {
		return request(`/api/meshes/${mesh}/endpoints/${ep}/apps/${provider}/${app}`);
	}
	downloadApp({
		mesh, ep, provider, app
	}) {
		return request(`/api/meshes/${mesh}/endpoints/${ep}/apps/${provider}/${app}`, "POST", {});
	}
	startApp({
		mesh, ep, provider, app
	}) {
		return request(`/api/meshes/${mesh}/endpoints/${ep}/apps/${provider}/${app}`, "POST", {
			isRunning: true
		});
	}
	stopApp({
		mesh, ep, provider, app
	}) {
		return request(`/api/meshes/${mesh}/endpoints/${ep}/apps/${provider}/${app}`, "POST", {
			isRunning: false
		});
	}
	pubApp({
		mesh, ep, provider,isPublished, app
	},callback) {
    confirm.custom({
        message: `Are you sure ${isPublished?'publish':'cancel publish'} [${app}] app to [${mesh}] mesh?`,
        header: isPublished?'Publish':'Cancel publish',
        icon: isPublished?'pi pi-cloud-upload':'pi pi-cloud-download',
        accept: () => {
					request(`/api/meshes/${mesh}/endpoints/${ep}/apps/${provider}/${app}`, "POST", {
						isPublished
					}).then(()=>{
						if(!!callback)
						callback();
					});
        },
        reject: () => {
        }
    });
	}
	setApp({
		mesh, ep, provider, app, body
	}) {
		return request(`/api/meshes/${mesh}/endpoints/${ep}/apps/${provider}/${app}`, "POST", body);
	}
	removeApp({
		mesh, ep, provider, app, body
	},callback) {
		confirm.remove(() => {
			request(`/api/meshes/${mesh}/endpoints/${ep}/apps/${provider}/${app}`,"DELETE").then((res) => {
				toast.add({ severity: 'success', summary: 'Tips', detail: "Deleted", life: 3000 });
				if(!!callback)
				callback(res);
			}).catch(err => {
				if(!!callback)
				callback(res);
			});
		});
	}
	getAppLog({
		mesh, ep, provider, app
	}) {
		return request(`/api/meshes/${mesh}/endpoints/${ep}/apps/${provider}/${app}/log`);
	}
  //
  // Files
  //   hash: string
  //   time: number
  //   size: number
  //
	getFiles(mesh) {
		return request(`/api/meshes/${mesh}/files`);
	}
	getFileInfo(mesh) {
		return request(`/api/meshes/${mesh}/files/*`);
	}
	getFileData(mesh) {
		return request(`/api/meshes/${mesh}/file-data/*`);
	}
	getFileDataFromEP(mesh, ep, hash) {
		return request(`/api/meshes/${mesh}/endpoints/${ep}/file-data/${hash}`);
	}
	newApp(appJSON, callback) {
		
		const meshData = {
			ca: appJSON.ca,
			agent: appJSON.agent,
			bootstraps: appJSON.bootstraps
		}
		if(!!meshData.agent.name){
			const min = 30000;
			const max = 40000;
			const agentNo = Math.floor(Math.random() * (max - min + 1)) + min;
			meshData.agent.name = `agent$-${agentNo}`
		}
		ztmService.getMesh(appJSON.name).then((res)=>{
			if(!!res?.name){
				this.addShortcut(res, appJSON)
				if(callback){
					callback()
				}
			} else {
				ztmService.joinMesh(appJSON.name||`mesh${agentNo}`, meshData)
					.then(mesh => {
						console.log(res)
						console.log("create mesh [done]")
						if(!!mesh?.name && !!appJSON.url){
							this.addShortcut(mesh, appJSON)
						}
						if(callback){
							callback()
						}
					})
					.catch(err => {
						console.log(err);
						toast.add({ severity: 'error', summary:'Tips', detail: 'json format errors.', life: 3000 });
						if(callback)
						callback()
					}); 
			}
		})
	}
	
	addShortcut(mesh, appJSON) {
		let shortcuts = []
		try{
			shortcuts = JSON.parse(localStorage.getItem("SHORTCUT")||"[]");
		}catch(e){
			shortcuts = []
		}
		shortcuts.push({
			mesh,
			provider:'ztm',
			name:'proxy',
			icon:appJSON.icon,
			label:appJSON.app||appJSON.name,
			url:appJSON.url,
			proxy:!!appJSON.endpoint,
			ep:appJSON.endpoint
		});
		store.commit('account/setShortcuts', shortcuts);
	}
	setProxyOutbound({mesh, endpoint}){
		const options = {
			mesh:mesh?.name,
			ep:mesh?.agent?.id,
			provider:'ztm',
			app:'proxy',
		}
		const base = this.getAppUrl(options);
		// set remote targets
		this.invokeAppApi({
			base,
			url:`/api/endpoints/${endpoint}/config`,
		}).then(res => {
			if(!!res && !!res.targets && res.targets.length >0){
			} else {
				const outbound = { targets: ['*','0.0.0.0/0']}
				// set remote targets
				let eps = localStorage.getItem("PROXY-EPS");
				eps = !!eps?eps.split(","):[];
				this.invokeAppApi({
					base,
					url:`/api/endpoints/${endpoint}/config`,
					method: 'POST',
					body: outbound
				}).then(res => {
					if(!eps.find((_ep) => _ep == endpoint)){
						eps.push(endpoint);
						localStorage.setItem("PROXY-EPS",eps.join(","))
					}
				})
				.catch(err2 => {
					console.log("set remote targets error")
					console.log(err2)
					if(callback)
					callback()
				}); 
			}
		})
		.catch(err1 => {
			console.log("get remote targets error")
			console.log(err1)
			if(callback)
			callback()
		}); 
	}
	async loadApps() {
		const apps = [];
		const res = await ztmService.getMeshes();
		console.log('[meshes]');
		console.log(res)
		for (let mesh of (res || [])) {
			const app = {...mesh};
			app.icon = localStorage.getItem(`${app.name}-icon`);
			app.url = localStorage.getItem(`${app.name}-url`);
			const res2 = await ztmService.getPorts({
				mesh:mesh.name,
				ep:mesh.agent?.id
			});
			const svc = localStorage.getItem(`${app.name}-svc`);
			(res2||[]).forEach((port)=>{
				if(port.target?.service == svc){
					app.port = port;
					apps.push(app);
				}
			})
		}
		return apps;
	}
	removeShortcut(app, callback) {
		confirm.remove(() => {
			let shortcuts = []
			try{
				shortcuts = JSON.parse(localStorage.getItem("SHORTCUT")||"[]");
			}catch(e){
				shortcuts = []
			}
			shortcuts = shortcuts.filter((shortcut)=> !(shortcut.label == app.label && shortcut.url == app.url))
			store.commit('account/setShortcuts', shortcuts);
		});
	}
}
