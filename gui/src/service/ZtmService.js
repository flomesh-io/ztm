import { request } from './common/request';
import toast from "@/utils/toast";
import confirm from "@/utils/confirm";
import { invoke } from '@tauri-apps/api/core';
import { platform } from '@/utils/platform';
import { writeMobileFile } from '@/utils/file';
import {
	initStore, getItem, setItem, encryptPEM, decryptPEM
} from "@/utils/store";

import { getItem as getKeychainItem, saveItem as saveKeychainItem } from 'tauri-plugin-keychain';


const VITE_APP_PUB_HUB_CN = import.meta.env.VITE_APP_PUB_HUB_CN;
const VITE_APP_PUB_HUB_US = import.meta.env.VITE_APP_PUB_HUB_US;

export default class ZtmService {
	getPubHub() {
		const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		if (timeZone === "Asia/Shanghai" || timeZone === "Asia/Chongqing") {
			const pm = platform();
			if(pm == 'ios'){
				return '';
			} else {
				return VITE_APP_PUB_HUB_CN;
			}
		} else if (timeZone === "Asia/Hong_Kong") {
			return VITE_APP_PUB_HUB_CN;
		} else {
			return VITE_APP_PUB_HUB_US;
		}
	}
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
		if(pm == 'ios'){
			writeMobileFile('keychainSave.txt',privatekey);
			saveKeychainItem('privatekey', privatekey).then(()=>{
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
		if(pm == 'ios'){
			getKeychainItem('privatekey').then((keychain_privatekey)=>{
				callback(keychain_privatekey)
			}).catch((e)=>{
				const errorDetails = e.message || e.stack || e.toString();
				writeMobileFile('getKeychainError.txt',errorDetails);
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
	resetPrivateKey(callback) {
		confirm.custom({
				message: `If reset the private key, your permit will be expire.`,
				header: 'Tips',
				icon: 'pi pi-refresh',
				accept: () => {
					this.createPrivateKey(callback)
				},
				reject: () => {
				}
		});
	}
	mergePrivateKey(callback) {
		initStore().then(()=>{
			// request identity
			this.identity().then(identity => {
				// get store identity
				getItem('identity').then((identity2)=>{
					if(!!identity && identity == identity2?.value){
						writeMobileFile('identityRight.txt','true');
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
	getPermit(PublicKey, UserName) {
		return request(`${this.getPubHub()}/permit`,"POST",{PublicKey, UserName});
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
