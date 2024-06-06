import { request } from './common/request';
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
				if(!!res){
					const ep = res?.agent?.id;
					const proto = 'tcp';
					const svcData = {
						mesh: appJSON.name,
						ep,
						name: `${appJSON.name}-svc`,
						proto,
						host: appJSON.host,
						port: appJSON.port,
						users: null
					}
					localStorage.setItem(`${appJSON.name}-icon`,appJSON.icon);
					localStorage.setItem(`${appJSON.name}-url`,appJSON.url);
					pipyProxyService.createService(svcData)
						.then(res2 => {
							if(res2){
								const portData = {
									mesh: appJSON.name,
									ep,
									proto,
									ip: '127.0.0.1',
									port: appJSON.localPort,
									body: { 
										target: {
											service: `${appJSON.name}-svc`
										}
									}
								};
								pipyProxyService.createPort(portData)
									.then(res => {
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
							toast.add({ severity: 'error', summary:'Tips', detail: 'svc format errors.', life: 3000 });
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
			
		for (let mesh of (res || [])) {
			const app = {...mesh};
			app.icon = localStorage.getItem(`${app.name}-icon`);
			app.url = localStorage.getItem(`${app.name}-url`);
			const res2 = await pipyProxyService.getPorts({
				mesh:mesh.name,
				ep:mesh.agent?.id
			});
			(res2||[]).forEach((port)=>{
				if(port.target?.service == `${app.name}-svc`){
					app.port = port;
					apps.push(app);
				}
			})
		}
		return apps;
	}
	removeApp(name) {
		pipyProxyService.deleteMesh(name,() => {
		});
	}
}
