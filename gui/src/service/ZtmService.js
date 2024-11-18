import { request } from './common/request';
import toast from "@/utils/toast";
import confirm from "@/utils/confirm";
import { invoke } from '@tauri-apps/api/core';
import { platform } from '@/utils/platform';
import { writeMobileFile } from '@/utils/file';
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
	setPrivatekey(privatekey, callback) {
		const pm = platform();
		if(pm == 'ios' || pm == 'android'){
			writeMobileFile('keychainSave.txt',privatekey);
			invoke('plugin:keychain|save_item',{ key: 'privatekey', password: privatekey }).then(()=>{
				callback();
			}).catch((e)=>{
				const errorDetails = e.message || e.stack || e.toString();
				writeMobileFile('keychainSaveError.txt', errorDetails);
			})
		} else if(!pm  || pm == 'web') {
			callback()
		} else {
			encryptPEM(privatekey).then((code)=>{
				setItem('privatekey', code);
				callback();
			});
		}
	}
	getPrivateKey(callback){
		const pm = platform();
		if(pm == 'ios' || pm == 'android'){
			invoke('plugin:keychain|get_item',{ key: 'privatekey'}).then((keychain_resp)=>{
				const keychain_privatekey = keychain_resp?.password;
				callback(keychain_privatekey)
			}).catch((e)=>{
				writeMobileFile('getKeychainError.txt',e.toString());
			})
		} else if(!pm  || pm == 'web') {
			callback()
		} else {
			getItem('privatekey').then((r)=>{
				if(!!r?.value){
					decryptPEM(r?.value).then((code)=>{
						callback(code)
					})
				} else {
					callback()
				}
			})
		}
	}
	createPrivateKey(callback) {
		invoke('create_private_key',{}).then((newPrivatekey)=>{
			
			this.setPrivatekey(newPrivatekey, () => {});
			this.pushPrivateKey(newPrivatekey).then((identity)=>{
				setItem('identity', identity);
				callback(identity)
			})
		});
	}
	mergePrivateKey(callback) {
		writeMobileFile('mergePrivateKeyStart.txt','true');
		initStore().then(()=>{
			// request identity
			this.identity().then(identity => {
				// get store identity
				getItem('identity').then((identity2)=>{
					if(!!identity && identity == identity2?.value){
						writeMobileFile('identityRight.txt','true');
						console.log('identityRight')
						callback()
					} else {
						// get privatekey
						this.getPrivateKey((privatekey)=>{
							if(!privatekey){
								// new privatekey
								this.createPrivateKey(callback);
							} else {
								// reset privateKey
								this.pushPrivateKey(privatekey).then((res)=>{
									setItem('identity', res);
									writeMobileFile('privatekeyReset.txt','true');
									callback(res)
								})
							}
						})
					}
				})
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
