import { request,requestNM } from './common/request';
import toast from "@/utils/toast";
import confirm from "@/utils/confirm";
import PipyProxyService from '@/service/PipyProxyService';
const pipyProxyService = new PipyProxyService();
export default class AppService {
	newApp(appJSON, callback) {
		const meshData = {
			name: appJSON.name,
			ca: appJSON.ca,
			agent: appJSON.agent,
			bootstraps: appJSON.bootstraps
		}
		pipyProxyService.joinMesh(appJSON.name, meshData)
			.then(res => {
				console.log(res)
				console.log("create mesh [done]")
				if(!!res){
					const ep = res?.agent?.id;
					const proto = 'tcp';
					localStorage.setItem(`${appJSON.name}-icon`,appJSON.icon);
					localStorage.setItem(`${appJSON.name}-url`,appJSON.url);
					localStorage.setItem(`${appJSON.name}-svc`,appJSON.service);
					const min = 30000;
					const max = 40000;
					const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;
					const portData = {
						mesh: appJSON.name,
						ep,
						proto,
						ip: '127.0.0.1',
						port: randomNumber,
						body: { 
							target: {
								service: appJSON.service
							}
						}
					};
					if(!!appJSON.endpoint){
						portData.body.target.endpoint = appJSON.endpoint;
					}
					pipyProxyService.createPort(portData)
						.then(res => {
							console.log("create port [done]")
							if(!!res){
								if(callback)
								callback()
							}
						})
						.catch(err => {
							console.log(err);
							toast.add({ severity: 'error', summary:'Tips', detail: 'local port format errors.', life: 3000 });
							if(callback)
							callback()
						}); 
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
