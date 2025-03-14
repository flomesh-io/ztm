import { mock, request, getUrl,merge } from './common/request';
import toast from "@/utils/toast";
import confirm from "@/utils/confirm";
import { v4 as uuidv4 } from 'uuid';
import _ from 'lodash';
import store from "@/store";

export default class ChatService {
	
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
			app:'users',
		}
		const base = getUrl(`/api/meshes/${options?.mesh}/apps/${options?.provider}/${options?.app}`);
		return request(`${base}${url}`, method, body, config);
	}
	
	getUsers() {
		return this.request(`/api/users`, "GET");
	}
	getGroups() {
		return this.request(`/api/groups`, "GET");
	}
	getGroup(group) {
		return this.request(`/api/groups/${group}`, "GET");
	}
	newGroup({name, users, callback}) {
		const group = uuidv4();
		this.request(`/api/groups/${group}`, "POST", {
			name, users
		}).then(()=>{
			if(callback){
				callback({
					group,
					name, 
					users
				})
			}
		});
	}
	removeGroup({group, callback}) {
		confirm.custom({
				message: `Are you sure to remove this group?`,
				header: 'Tip',
				icon: 'pi pi-info-circle',
				accept: () => {
					this.request(`/api/groups/${group}`, "DELETE").then(()=>{
						if(callback){
							callback()
						}
					});
				},
				reject: () => {
				}
		});
	}
	appendGroupUser({group, users, callback}) {
		this.getGroup(group).then((res) => {
			const _d = res;
			_d.users = users;
			this.request(`/api/groups/${group}`, "POST", _d).then(()=>{
				if(callback){
					callback({
						..._d,
						group, 
					})
				}
			});
		})
	}
	exitGroupUser({group, user, callback}) {
		confirm.custom({
				message: `Are you sure to remove user [${user}] from this group?`,
				header: 'Tip',
				icon: 'pi pi-info-circle',
				accept: () => {
					this.getGroup(group).then((res) => {
						const _d = {
							name:res.name, users:res.users.filter((m) => m != user)
						}
						this.request(`/api/groups/${group}`, "POST", _d).then(()=>{
							if(callback){
								callback({
									..._d,
									group, 
								})
							}
						});
					})
				},
				reject: () => {
				}
		});
	}
	
	setGroupName({group, name, callback}) {
		this.getGroup(group).then((res) => {
			const _d = {
				name:name, users:res.users,
			}
			this.request(`/api/groups/${group}`, "POST", _d).then(()=>{
				if(callback){
					callback({
						..._d,
						group
					})
				}
			});
		})
	}
	getUserGroups(user) {
		return this.request(`/api/groups/user/${user}`, "GET");
	}
}
