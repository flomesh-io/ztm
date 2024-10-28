import { mock, request, getUrl } from './common/request';
import toast from "@/utils/toast";
import confirm from "@/utils/confirm";
import { v4 as uuidv4 } from 'uuid';
import _ from 'lodash';
import store from "@/store";

export default class ChatService {
	
	getHeader(body) {
		if(typeof(body) == 'string'){
			return {
				headers:{ "Content-Type": "text/plain" }
			}
		} else {
			return null;
		}
	}
	getAppUrl({
		mesh, provider, app
	}) {
		return getUrl(`/api/meshes/${mesh}/apps/${provider}/${app}`);
	}
	getMesh(){
		return store.getters['account/selectedMesh'];
	}
	request(url, method, body){
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
		const base = this.getAppUrl(options);
		if(!!body){
			return request(`${base}${url}`, method, body);
		}else{
			return request(`${base}${url}`, method);
		}
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
	newGroupMsg(group, creator, body) {
		return this.request(`/api/groups/${creator}/${group}/messages`, "POST", body);
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
	newPeerMsg(user, body) {
		return this.request(`/api/peers/${user}/messages`, "POST", body);
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
