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


const VITE_APP_PUB_HUB_JP = import.meta.env.VITE_APP_PUB_HUB_JP;
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
		} else if (timeZone === "Asia/Tokyo") {
			return VITE_APP_PUB_HUB_JP;
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
	getPermit(PublicKey, UserName, pubHub) {
		return request(pubHub||`${this.getPubHub()}/permit`,"POST",{PublicKey, UserName});
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
	makePaging(params) {
		let paramsAry = [];
		if(params && Object.keys(params).length>0){
			if(params?.id){
				paramsAry.push(`id=${encodeURIComponent(params.id)}`)
			}
			if(params?.user){
				paramsAry.push(`user=${encodeURIComponent(params.user)}`)
			}
			if(params?.name){
				paramsAry.push(`name=${encodeURIComponent(params.name)}`)
			}
			if(params?.keyword){
				paramsAry.push(`keyword=${encodeURIComponent(params.keyword)}`)
			}
			if(params?.offset){
				paramsAry.push(`offset=${params.offset}`)
			}
			if(params?.limit){
				paramsAry.push(`limit=${params.limit}`)
			}
			return `?${paramsAry.join('&')}`
		} else {
			return '';
		}
	}
	getAppMesh(){
		const devPath = localStorage.getItem("DEV_BASE")
		const match1 = location.href.match(/meshes\/(.*?)\/apps/);
		const match2 = (devPath||'').match(/meshes\/(.*?)\/apps/);
		if(match1 && match1[1]){
			return match1[1];
		} else if(!!devPath && match2 && match2[1]) {
			return match2[1];
		} else {
			return "";
		}
	}
	getEndpoint(mesh, ep) {
		let _mesh = mesh;
		if(!_mesh){
			_mesh = this.getAppMesh()
		}
		console.log(ep)
		return request(`/api/meshes/${_mesh}/endpoints/${ep}`);
	}
	getEndpoints(mesh, params) {
		let _mesh = mesh;
		if(!_mesh){
			_mesh = this.getAppMesh()
		}
		return request(`/api/meshes/${_mesh}/endpoints${this.makePaging(params)}`);
	}
	getUsers(mesh, params) {
		let _mesh = mesh;
		if(!_mesh){
			_mesh = this.getAppMesh()
		}
		return request(`/api/meshes/${_mesh}/users${this.makePaging(params)}`);
	}
	getVersion() {
		return request(`/api/version`);
	}
	changeEpLabels(mesh, ep, labels) {
		return request(`/api/meshes/${mesh}/endpoints/${ep}/labels`, "POST", labels);
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
