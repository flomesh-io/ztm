import { request,requestNM,getUrl } from './common/request';
import toast from "@/utils/toast";
import confirm from "@/utils/confirm";
import { openWebview } from '@/utils/webview';
import store from "@/store";
import PipyProxyService from '@/service/PipyProxyService';
const pipyProxyService = new PipyProxyService();
export default class AppService {
	
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
		
	openBroswer({endpoint, url,width,height, mesh, provider, name}) {
		const options = {
			mesh:mesh?.name,
			ep:mesh?.agent?.id,
			provider:provider||'ztm',
			app:name,
		}
		const base = this.getAppUrl(options);
		const min = 30000;
		const max = 40000;
		const randomPort = Math.floor(Math.random() * (max - min + 1)) + min;
		const listen = `127.0.0.1:${randomPort}`;
		if(!endpoint){
			this.openWV(url,width,height)
			return
		}
		// set local listen
		this.invokeAppApi({
			base,
			url:`/api/endpoints/${mesh?.agent?.id}/config`,
			method: 'GET',
		})
			.then(config1 => {
				this.invokeAppApi({
					base,
					url:`/api/endpoints/${mesh?.agent?.id}/config`,
					method: 'POST',
					body:{ 
						...config1,
						listen
					}
				})
					.then(res => {
						console.log(res)
						// get remote config
						this.invokeAppApi({
							base,
							url:`/api/endpoints/${endpoint}/config`,
							method: 'GET',
						})
							.then(config => {
								console.log(config)
								const body = config;
								if(!body.targets){
									body.targets = []
								}
								if(!body.targets.find((t)=> t == "*")){
									body.targets.push("*")
								}
								if(!body.targets.find((t)=> t == "0.0.0.0/0")){
									body.targets.push("0.0.0.0/0")
								}
								// set remote targets
								this.invokeAppApi({
									base,
									url:`/api/endpoints/${endpoint}/config`,
									method: 'POST',
									body
								})
									.then(res => {
										this.openWV(url,width,height, listen)
									})
									.catch(err1 => {
										console.log("set remote targets errors")
										console.log(err1)
									}); 
							})
							.catch(err2 => {
								console.log("set remote targets errors")
								console.log(err2)
							}); 
					})
					.catch(err3 => {
						console.log("set remote targets errors")
						console.log(err3)
					}); 
			
			})
			.catch(err3 => {
				console.log("set remote targets errors")
				console.log(err3)
			}); 
			
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
		mesh, ep, provider, app, body
	}) {
		return request(`/api/meshes/${mesh}/endpoints/${ep}/apps/${provider}/${app}`, "POST", {
			isPublished: true
		});
	}
	unpubApp({
		mesh, ep, provider, app, body
	}) {
		return request(`/api/meshes/${mesh}/endpoints/${ep}/apps/${provider}/${app}`, "POST", {
			isPublished: false
		});
	}
	setApp({
		mesh, ep, provider, app, body
	}) {
		return request(`/api/meshes/${mesh}/endpoints/${ep}/apps/${provider}/${app}`, "POST", body);
	}
	deleteApp({
		mesh, ep, provider, app, body
	}) {
		return request(`/api/meshes/${mesh}/endpoints/${ep}/apps/${provider}/${app}`,"DELETE");
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
		
		const min = 30000;
		const max = 40000;
		const agentNo = Math.floor(Math.random() * (max - min + 1)) + min;
		const meshData = {
			name: appJSON.name,
			ca: appJSON.ca,
			agent: {
				...appJSON.agent,
				name:`agent$-${agentNo}`
			},
			bootstraps: appJSON.bootstraps
		}
		pipyProxyService.joinMesh(appJSON.name, meshData)
			.then(res => {
				console.log(res)
				console.log("create mesh [done]")
				if(!!res){
					let shortcuts = []
					try{
						shortcuts = JSON.parse(localStorage.getItem("SHORTCUT")||"[]");
					}catch(e){
						shortcuts = []
					}
					shortcuts.push({
						mesh: res,
						name:'proxy',
						icon:appJSON.icon,
						provider:'ztm',
						label:appJSON.name,
						url:appJSON.url,
						endpoint:appJSON.endpoint,
					});
					store.commit('account/setShortcuts', shortcuts);
					if(callback)
					callback()
				}
			})
			.catch(err => {
				console.log(err);
				toast.add({ severity: 'error', summary:'Tips', detail: 'app.json format errors.', life: 3000 });
				if(callback)
				callback()
			}); 
	}
	async loadApps() {
		const apps = [];
		const res = await pipyProxyService.getMeshes();
		console.log('[meshes]');
		console.log(res)
		for (let mesh of (res || [])) {
			const app = {...mesh};
			app.icon = localStorage.getItem(`${app.name}-icon`);
			app.url = localStorage.getItem(`${app.name}-url`);
			const res2 = await pipyProxyService.getPorts({
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
	removeApp(app, callback) {
		confirm.remove(() => {
			const ip = app?.port?.listen?.ip;
			const port = app?.port?.listen?.port;
			pipyProxyService.getMesh(app.name)
				.then(mesh => {
					localStorage.removeItem(`${app.name}-icon`);
					localStorage.removeItem(`${app.name}-url`);
					localStorage.removeItem(`${app.name}-svc`);
					requestNM(`/api/meshes/${app.name}/endpoints/${mesh?.agent?.id}/ports/${ip}/tcp/${port}`,"DELETE").then((res) => {
						requestNM(`/api/meshes/${app.name}`,"DELETE").then((res) => {
							!!callback && callback(res);
						}).catch(err => {
							!!callback && callback(err);
						});
					}).catch(err => {
					});
				})
				.catch(err => {
				}); 
		});
	}
}
