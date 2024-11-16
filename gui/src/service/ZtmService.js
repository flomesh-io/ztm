import { request } from './common/request';
import toast from "@/utils/toast";
import confirm from "@/utils/confirm";
import { invoke } from '@tauri-apps/api/core';
import {
	initStore, getItem, setItem, encryptPEM, decryptPEM
} from "@/utils/store";
export default class ZtmService {
	login(user, password) {
		return request('/api/login', "POST", {
			user, password
		});
	}
	identity() {
		return request('/api/identity',"GET",null, {headers:{
			"Content-Type": "text/plain"
		}});
	}
	pushPrivateKey(privatekey) {
		return request(`/api/identity`, "POST", privatekey, {headers:{
			"Content-Type": "text/plain"
		}});
	}
	mergePrivateKey(callback) {
		initStore().then(()=>{
			getItem('privatekey').then((r)=>{
				// no privatekey
				if(!r?.value){
					//keychain service checking
					if(false){
						let keychain_privatekey = "xxxx";
						// keychain privatekey
						setItem('privatekey', keychain_privatekey);
						decryptPEM(privatekey?.value).then((code)=>{
							this.pushPrivateKey(code).then((identity)=>{
								setItem('identity', identity);
								callback(identity)
							})
						})
					} else {
						// new privatekey
						invoke('create_private_key',{}).then((newPrivatekey)=>{
							console.log('newPrivatekey')
							encryptPEM(newPrivatekey).then((code)=>{
								setItem('privatekey', code);
							});
							this.pushPrivateKey(newPrivatekey).then((identity)=>{
								setItem('identity', identity);
								callback(identity)
							})
						});
					}
				} else {
					this.identity().then(identity => {
						// has identity
						getItem('identity').then((identity2)=>{
							if(!!identity && identity == identity2.value){
									console.log('privatekey right')
							} else {
								// reset privateKey
								decryptPEM(privatekey?.value).then((code)=>{
									this.pushPrivateKey(code).then((res)=>{
										setItem('identity', res);
										console.log('reset privatekey')
										callback(res)
									})
								})
							}
						})
					})
				}
			})
		})
	}
	info({id}) {
		return request('/api/info');
	}
	inviteEp(mesh, username, identity) {
		return request(`/api/meshes/${mesh}/permits/${username}`, "POST", identity, {headers:{
			"Content-Type": "text/plain"
		}});
	}
	deleteEp(mesh, username, callback) {
		confirm.remove(() => {
			request(`/api/meshes/${mesh}/permits/${username}`,"DELETE").then((res) => {
				toast.add({ severity: 'success', summary: 'Tips', detail: `${username} permit deleted.`, life: 3000 });
				if(!!callback)
				callback(res);
			}).catch(err => {
				if(!!callback)
				callback(res);
			});
		});
	}
	getMeshes() {
		return request('/api/meshes');
	}
	getMesh(name) {
		return request(`/api/meshes/${name}`);
	}
	joinMesh(name, config) {
		if(config.bootstraps){
			config.bootstraps = config.bootstraps.filter(n=>!!n)
		}
		delete config.connected;
		delete config.errors;
		if(!!config.agent && !config.agent.privateKey){
			delete config.agent.privateKey;
		}
		return request(`/api/meshes/${name}`,"POST",config);
	}
	getLogs(mesh, ep) {
		return request(`/api/meshes/${mesh}/endpoints/${ep}/log`);
	}
	getEndpointStats(mesh) {
		return request(`/api/meshes/${mesh}/stats/endpoints`);
	}
	getEndpoints(mesh) {
		return request(`/api/meshes/${mesh}/endpoints`);
	}
	getVersion() {
		return request(`/api/version`);
	}
	deleteMesh(name,callback) {
		confirm.remove(() => {
			request(`/api/meshes/${name}`,"DELETE").then((res) => {
				toast.add({ severity: 'success', summary: 'Tips', detail: "Deleted", life: 3000 });
				if(!!callback)
				callback(res);
			}).catch(err => {
				if(!!callback)
				callback(res);
			});
		});
	}
	invoke({
		id,
		config
	}) {
		return request('/api/invoke',"POST",config);
	}
}
