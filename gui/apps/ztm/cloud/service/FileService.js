import { request,getMetaUrl,getUrl, merge, spread } from '@/service/common/request';
import toast from "@/utils/toast";
import confirm from "@/utils/confirm";
import { platform } from '@/utils/platform';
import { homeDir, documentDir } from '@tauri-apps/api/path';
export default class FileService {
	/*

	"sources": I
	"86540a10-576d-47d1-8d9f-e0184830f152"'
	"path"': "/users/root/89.mp4",
	"state":"missing",
	"size":1724328877486,
	'time": 1724328877486.
	'hash": "48effab79269626be8604ad98e394a4f2ed2850fce79abfa6e49975d147464f" ,
	"downloading":0.931241211
	*/
 /*
 state:
 outdated
 missing
 changed
 new
 synced
 */
	getInfo() {
		return request(`/api/appinfo`);
	}
	getEndpoints() {
		return request(`/api/endpoints`);
	}
	getDir() {
		return documentDir();
	}
	getConfig(ep) {
		return request(`/api/endpoints/${ep}/config`)
	}
	setConfig(ep, body) {
		return request(`/api/endpoints/${ep}/config`,"POST", body)
	}
	getMirror(path, ep) {
		if(!!path && path != "/"){
			return request(`/api/endpoints/${ep}/mirrors${path}`)
		}else{
			return request(`/api/endpoints/${ep}/mirrors`)
		}
	}
	setMirror(path, ep, body) {
		if(!!path && path != "/"){
			return request(`/api/endpoints/${ep}/mirrors${path}`,"POST", body)
		}else{
			return request(`/api/endpoints/${ep}/mirrors`,"POST", body)
		}
	}
	
	getMirrors(path,eps, callback, error) {
		let reqs = [];
		// merge request
		(eps||[]).forEach((ep)=>{
			const req = this.getMirror(path, ep?.id).then((res)=> {
				return { data:res, ep }
			}).catch((e)=>{
			})
			reqs.push(req);
		})
		
		return merge(reqs).then((allRes) => {
			if(!!callback)
			callback(allRes||[], eps)
		}).catch(()=>{
			if(!!error)
			error()
		})
	}
	getFileMetaUrl(path) {
		return getMetaUrl(`/api/file-data${path}`)
	}
	getFileData(path) {
		return request(`/api/file-data${path}`)
	}
	getFiles(path) {
		if(!!path && path != "/"){
			return request(`/api/files${path}`)
		}else{
			return request(`/api/files`)
		}
	}
	getAcl(path) {
		return request(`/api/acl${path}`)
	}
	setAcl(path, body) {
		return request(`/api/acl${path}`,"POST", body)
	}
	getUploads() {
		return request(`/api/uploads`);
	}
	upload(path) {
		return request(`/api/uploads`,"POST",{
			path
		});
	}
	getDownloads() {
		return request(`/api/downloads`);
	}
	download(path) {
		return request(`/api/downloads`,"POST",{
			path
		});
	}
	cancelDownload(path, callback) {
		confirm.custom({
				message: `Are you sure want to cancel this file?`,
				header: 'Cancel download',
				rejectProps: {
						label: 'Close',
						severity: 'secondary',
						outlined: true
				},
				acceptProps: {
						severity: 'danger',
						label: 'Ok'
				},
				icon: 'pi pi-info-circle',
				accept: () => {
					request(`/api/downloads${path}`,"DELETE").then(()=>{
						if(!!callback)
						callback();
					}).catch((e)=>{
						if(!!callback)
						callback(e);
					});
				},
				reject: () => {
				}
		});
	}
}
