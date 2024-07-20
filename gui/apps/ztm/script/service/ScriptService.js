import { request, merge, spread } from '@/service/common/request';
import toast from "@/utils/toast";
import confirm from "@/utils/confirm";
export default class ScriptService {
	getInfo() {
		return request(`/api/appinfo`);
	}
	getEndpoints() {
		return request(`/api/endpoints`);
	}
	getScripts() {
		const scriptKeys = JSON.parse(localStorage.getItem("SCRIPTS")||"[]");
		const scripts = [];
		scriptKeys.forEach((scriptKey)=>{
			scripts.push({
				name:scriptKey,
				script:localStorage.getItem(`SCRIPT:${scriptKey}`)
			})
		});
		return scripts;
	}
	saveScript(name, script) {
		const scriptKeys = JSON.parse(localStorage.getItem("SCRIPTS")||"[]");
		if(!scriptKeys.find((_key)=>_key==name)){
			scriptKeys.push(name);
		}
		localStorage.setItem("SCRIPTS",JSON.stringify(scriptKeys));
		localStorage.setItem(`SCRIPT:${name}`,script);
	}
	removeScript(name) {
		const scriptKeys = JSON.parse(localStorage.getItem("SCRIPTS")||"[]");
		localStorage.setItem("SCRIPTS",JSON.stringify(scriptKeys.filter((_key)=>_key!=name)));
		localStorage.removeItem(`SCRIPT:${name}`);
	}
	postScript({
		script, args, ep
	}) {
		let argv = "";
		if(!!args && args.length>0){
			argv = encodeURIComponent(JSON.stringify(args.filter((arg)=> arg!='')))
		}
		const argvParams = !!argv?`?argv=${argv}`:''
		// set local listen
		return request(`/api/endpoints/${ep}/script${argvParams}`,"POST", script, {headers:{
			"Content-Type": "text/plain"
		}})
	}
}
