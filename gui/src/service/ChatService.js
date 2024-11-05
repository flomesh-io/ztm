import { mock, request, getUrl,merge } from './common/request';
import toast from "@/utils/toast";
import confirm from "@/utils/confirm";
import { v4 as uuidv4 } from 'uuid';
import _ from 'lodash';
import store from "@/store";
import { binaryStringToBlob,createObjectURL } from 'blob-util'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

export default class ChatService {
	
	getHeader(type) {
		if(!!type){
			return {
				headers:{ "Content-Type": type }
			}
		} else {
			return null;
		}
	}
	getMesh(){
		return store.getters['account/selectedMesh'];
	}
	request(url, method, body, config){
		const mesh = this.getMesh();
		if(!mesh?.name){
			return 
		}
		const options = {
			mesh:mesh?.name,
			ep:mesh?.agent?.id,
			provider:'ztm',
			app:'chat',
		}
		const base = getUrl(`/api/meshes/${options?.mesh}/apps/${options?.provider}/${options?.app}`);
		return request(`${base}${url}`, method, body, config);
	}
	
	getAppUrl(url){
		const mesh = this.getMesh();
		if(!mesh?.name){
			return 
		}
		const options = {
			mesh:mesh?.name,
			ep:mesh?.agent?.id,
			provider:'ztm',
			app:'chat',
		}
		const base = getUrl(`/api/meshes/${options?.mesh}/apps/${options?.provider}/${options?.app}`);
		return `${base}${url}`;
	}
	getUsers() {
		return this.request(`/api/users`, "GET");
	}
	/*
	[
		{
			group: "123",
			name: "group-name",
			time: 1729667314592,
			updated: true,
			creator: "root",
			latest: {
				time: 1729667314592,
				type: "text",
				message:{
					type: "text",
					content: "hello",
				},
				sender: "root"
			}
		},
		{
			peer: "root",
			time: 1729667314592,
			updated: true,
			latest: {
				time: 1729667314592,
				message:{
					type: "text",
					content: "hello",
				}
			}
		}
	]
	*/
	getRooms() {
		return this.request(`/api/chats`, "GET");
	}
	/*
	{
		creator: "root",
		group: "123",
		name: "group-name",
		members: [
			"guest"
		]
	}
	*/
	getGroup(group, creator) {
		return this.request(`/api/groups/${creator}/${group}`, "GET");
	}
	
	newGroup({name, members, callback}) {
		const creator = this.getMesh()?.agent?.username;
		const group = uuidv4();
		this.request(`/api/groups/${creator}/${group}`, "POST", {
			name, members
		}).then(()=>{
			if(callback){
				callback({
					group,
					creator,
					name, 
					members
				})
			}
		});
	}
	
	exitGroupMembers({group, creator, member, callback}) {
		
		const me = this.getMesh()?.agent?.username;
		confirm.custom({
				message: me == member ? `Are you sure to exit this group?` :`Are you sure to remove user [${member}] from this group?`,
				header: 'Tip',
				icon: 'pi pi-info-circle',
				accept: () => {
					this.getGroup(group, creator).then((res) => {
						const _room = {
							name:res.name, members:res.members.filter((m) => m != member)
						}
						this.request(`/api/groups/${creator}/${group}`, "POST", _room).then(()=>{
							if(callback){
								callback({
									..._room,
									group, 
									creator
								})
							}
						});
					})
				},
				reject: () => {
				}
		});
	}
	appendGroupMembers({group, creator, members, callback}) {
		this.getGroup(group, creator).then((res) => {
			const _room = {
				name:res.name, members//:_.union(res.members, members)
			}
			this.request(`/api/groups/${creator}/${group}`, "POST", _room).then(()=>{
				if(callback){
					callback({
						..._room,
						group, 
						creator
					})
				}
			});
		})
	}
	
	setGroupName({group, creator, name, callback}) {
		this.getGroup(group, creator).then((res) => {
			const _room = {
				name:name, members:res.members,
			}
			this.request(`/api/groups/${creator}/${group}`, "POST", _room).then(()=>{
				if(callback){
					callback({
						..._room,
						group, 
						creator
					})
				}
			});
		})
	}
	/*
	[
		{
			time: 1729667314592,
			message:{
				type: "text",
				content: "hello",
			}
			sender: "root",
		}
	]
	*/
	getGroupMsgs(group, creator, since, before) {
		let append = "";
		if(since || before){
			append = "?";
			if(since){
				append += `since=${since}`;
			}
			if(before){
				append += `&before=${before}`;
			}
		}
		return this.request(`/api/groups/${creator}/${group}/messages${append}`, "GET");
	}
	buildMsgBody(message, callback) {
		const body = {};
		if(!!message.text){
			body.text = message.text
		}
		if(!!message.files){
			body.files = [];
			const reqs = [];
			message.files.forEach((file)=>{
				reqs.push(this.uploadFile(file).then((hash)=> {
					return {
						hash,
						name: file.name,
						lastModified: file.lastModified,
						size: file.size,
						contentType: file.type,
					}
				}).catch((e)=>{}));
					
			})
			merge(reqs).then((resp)=>{
				if(resp){
					resp.forEach((file)=>{
						body.files.push(file);
					})
				}
				if(!!callback){
					callback(body)
				}
			})
		} else {
			if(!!callback){
				callback(body)
			}
		}
	}
	uploadFile(file, callback) {
		const contentType = file.type;
		// return file.arrayBuffer().then((body)=>{
		// 	return this.request(`/api/files`, "POST", body, this.getHeader(contentType))
		// })
		return this.request(`/api/files`, "POST", file, this.getHeader(contentType))
	}
	getFile(file,user) {
		return this.request(`/api/files/${user}/${file?.hash}`, "GET", null, this.getHeader(file?.contentType));
	}
	
	getFileUrl(file,user) {
		return this.getAppUrl(`/api/files/${user}/${file?.hash}`);
	}
	
	isBlob(file) {
		const type = file?.contentType || file?.type;
		const mimeTypes = ['audio'];
		if(mimeTypes.indexOf(type) >= 0){
			return true;
		} else {
			return false;
		}
	}
	getBlobSrc(file) {
		const urls = store.getters['blob/urls'];
		if(urls[file.src]){
			return urls[file.src]
		} else {
			return null
		}
	}
	reqBlobSrc(file,callback) {
		//'application/octet-stream'
		//file.contentType
		if(!!window.__TAURI_INTERNALS__){
			tauriFetch(file.src, {
			  method: 'GET', 
			  headers: {
			    'Content-Type': file.contentType,
			  }
			})
			.then(resp => {
				resp.blob().then((blob)=>{
					const _file = new File([blob], file.name, { type: blob.type });
					var url = URL.createObjectURL(_file);
					// const _file = new File([buffer], file.name, { type: file.contentType });
					// const url = URL.createObjectURL(_file);
					store.commit('blob/setUrl', [file.src,url]);
					if(callback) {
						callback(url)
					}
				})
			})
		} else {
			fetch(file.src, {
			  method: 'GET', // 或 'POST'、'PUT'、'DELETE' 等
			  headers: {
			    'Content-Type': 'application/octet-stream',
			  }
			})
			.then(resp => {
				resp.blob().then((blob)=>{
					var url = URL.createObjectURL(blob);
					debugger
					// const _file = new File([buffer], file.name, { type: file.contentType });
					// const url = URL.createObjectURL(_file);
					store.commit('blob/setUrl', [file.src,url]);
					if(callback) {
						callback(url)
					}
				})
			})
		}
		
		// request(file.src, "GET", null, this.getHeader('application/octet-stream')).then((resp)=>{
		// 	var blob = binaryStringToBlob(resp);
		// 	var url = createObjectURL(blob);
		// 	debugger
		// 	// const _file = new File([buffer], file.name, { type: file.contentType });
		// 	// const url = URL.createObjectURL(_file);
		// 	store.commit('blob/setUrl', [file.src,url]);
		// 	if(callback) {
		// 		callback(url)
		// 	}
		// })
	}
	/*
	message:
	{
		text: "Hey, how are you?", 
		files: [{
			src: "data:image/gif;base64...",
			ref: null,//File{...}
			type: "image"
		},{
			src: "npm.txt",
			ref: null,//File{...}
			type: "any"
		}]
	}
	
	body:
	{
		text: "Hey, how are you?",
		time: new Date().getTime(),
		files: [{
			hash,
			name: file.ref.name,
			size: file.ref.size,
			contentType: file.ref.type,
			type: message.type,
		}]
	}
	*/
	newGroupMsg(group, creator, message, callback) {
		this.buildMsgBody(message, (body)=>{
			this.request(`/api/groups/${creator}/${group}/messages`, "POST", body).then((resp)=>{
				if(callback){
					callback(body)
				}
			});
		});
	}
	/*
	[
		{
			time: 1729667314592,
			type: "text",
			message:{
				type: "text",
				content: "hello",
			}
			sender: "root",
		}
	]
	*/
	getPeerMsgs(user,since,before) {
		let append = "";
		if(since || before){
			append = "?";
			if(since){
				append += `since=${since}`;
			}
			if(before){
				append += `&before=${before}`;
			}
		}
		return this.request(`/api/peers/${user}/messages${append}`, "GET");
	}
	newPeerMsg(user, message, callback) {
		this.buildMsgBody(message, (body)=>{
			this.request(`/api/peers/${user}/messages`, "POST", body).then((resp)=>{
				if(callback){
					callback(body)
				}
			});
		});
	}
	getHistory({
		group, 
		creator,
		peer,
		today
	}) {
		const startOfDay = new Date(today);
		startOfDay.setHours(0, 0, 0, 0);
		const since = startOfDay.getTime();
		
		const endOfDay = new Date(today);
		endOfDay.setHours(23, 59, 59, 999);
		const before = endOfDay.getTime();
		if(group){
			return this.getGroupMsgs(group, creator, since, before);
		} else {
			return this.getPeerMsgs(peer, since, before);
		}
	}
}
