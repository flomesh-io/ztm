import { Command, Child, open } from '@tauri-apps/plugin-shell';
import { invoke } from '@tauri-apps/api/core';
import { resourceDir, appLogDir, appDataDir, appLocalDataDir, documentDir } from '@tauri-apps/api/path';
import { platform } from '@/utils/platform';
import { readTextFileLines, BaseDirectory } from '@tauri-apps/plugin-fs';
import ZtmService from '@/service/ZtmService';
import { relaunch } from "@tauri-apps/plugin-process";
import store from "@/store";

const ztmService = new ZtmService();
export default class ShellService {
	async getDB () {
		const appDataDirPath = await documentDir();
		return `${appDataDirPath}/ztmdb`
	}
	async openFinder() {
		const appDataDirPath = await documentDir();
		open(appDataDirPath)
	}
	async loadLog() {
		const pm = platform();
		if(true){
			
			store.commit('account/setLogs', []);
			const lines = await readTextFileLines('ztm.log', { baseDir: BaseDirectory.Document });
			const logs = [];
			let counter = 0;
			
			for await (const line of lines) {
			    if (line.indexOf("[INF]") >= 0) {
						store.commit('account/pushLog', { level: 'Info', msg: line });
			    } else {
						store.commit('account/pushLog', { level: 'Error', msg: line });
			    }
			
			    counter++;
			
			    // 每读取 100 行，暂停 10 秒
					if(counter >= 100) {
						break;
					}else if (counter >= 100) {
			        counter = 0; // 重置计数器
			        await new Promise(resolve => setTimeout(resolve, 1000)); // 暂停 10 秒
			    }
			}
			
		}
	}
	async takePipyVersion (apiGet) {
		console.log("takePipyVersion");
		if(false){
			let command = await Command.sidecar("bin/ztmctl", ['version','--json','','','','']);
			await command.spawn();
			command.stdout.on('data', line => {
				// console.log(line)
				//{"ztm":{"version":"v0.0.2","commit":"a73787b37cb500044410325b04558d2507a847f7","date":"Sat, 18 May 2024 18:55:27 +0800"},"pipy":{"version":"1.1.0-33","commit":"bd7450a98c9513394869493753456944aa26c1f7","date":"Sat, 18 May 2024 18:10:58 +0800"}}
				store.commit('account/setVersion', !!line ? JSON.parse(line) : {});
			});
		} else {
			ztmService.getVersion()
				.then(res => {
					if(!!res){
						// console.log(res)
						store.commit('account/setVersion', res);
					}
				})
				.catch(err => {
				}); 
		}
	}
	async startPipy (port, reset, callError){
		const pm = platform();
		console.log(pm)
		
		localStorage.setItem("VITE_APP_API_PORT", port);
		let resourceDirPath = '';
		// const appLogDirPath = await appLogDir();
		// `${resourceDirPath}/_up_/_up_/agent/main.js`,
		if(pm == "ios" ){
			let resourceDirPath = await documentDir();
			console.log(resourceDirPath)
			const args = [
				// "version",
				// "--version",
				"--pipy",
				"--version",
				// "repo://ztm/agent",
				// "--args",
				// `--listen`,
				// `${port}`,
				// `--data`,
				// `${resourceDirPath}/ztmdb`,
				// "--pipy-options",
				// // `--log-file=${resourceDirPath}/ztm.log`
				// "--log-local-only",
				// "pipy.listen(7777, $=>$)"
				
			];
			console.log(JSON.stringify(args))
			const filePath = await documentDir();
			// invoke('logto', {
			// 	lib:`${filePath}/../Library/libsayhello.dylib`,
			// 	arg: `${resourceDirPath}/libsayhello.log`
			// }).then((res)=>{
			// 	console.log(`[pipyioslib]Result: ${res}`);
			// });
			
			// invoke('pipylib', {
			// 	lib:`${filePath}/../Library/libpipy.dylib`,//libpipy.dylib//pipy.framework
			// 	argv: args,
			// 	argc: args.length
			// }).then((res)=>{
			// 	store.commit('account/setPid', 1);
			// 	setTimeout(()=>{
			// 		this.takePipyVersion(true);
			// 	},1000)
			// 	console.log(`[pipyioslib]Result: ${res}`);
			// });
		} else if(pm == "android" ){
			let resourceDirPath = await documentDir();//appLocalDataDir();
			console.log(resourceDirPath)
			const args = [
				"./main",
				"--pipy",
				"repo://ztm/agent",
				"--args",
				`--listen`,
				`${port}`,
				`--data`,
				`${resourceDirPath}/ztmdb`,
				"--pipy-options",
				`--log-file=${resourceDirPath}/ztm.log`,
			];
			console.log(args)
			const filePath = await appLocalDataDir();
			invoke('pipylib', {
				lib:`${filePath}/files/libztm.so`,
				argv: args,
				argc: args.length
			}).then((res)=>{
				store.commit('account/setPid', 1);
				setTimeout(()=>{
					this.takePipyVersion(true);
				},1000)
				console.log(`[pipylib]Result: ${res}`);
			});
		} else {
			let resourceDirPath = await documentDir();//resourceDir();
			// const args = [
			// 	"run",
			// 	"agent",
			// 	`--listen`,
			// 	`${port}`,
			// 	`--data`,
			// 	`${resourceDirPath}/ztmdb`,
			// 	"--pipy-options",
			// 	`--log-file=${resourceDirPath}/ztm.log`,
			// ];
			const args = [
				"--pipy",
				"repo://ztm/agent",
				"--args",
				`--listen`,
				`${port}`,
				`--data`,
				`${resourceDirPath}/ztmdb`,
				"--pipy-options",
				`--log-file=${resourceDirPath}/ztm.log`,
			];
			await this.pausePipy(port);
			console.log(`[starting pipy:${args}]`);
			const command = Command.sidecar("bin/ztmctl", args);
			command.on('close', data => {
				// console.log("[close]");
				// console.log(data);
				store.commit('account/pushLog', {level:'Info',msg:`pipy pause with code ${data.code} and signal ${data.signal}`});
			});
			command.stdout.on('data', line => {
				// console.log("[stdout]");
				// console.log(line);
				store.commit('account/pushLog', {level:'Info',msg:line});
			});
			command.stderr.on('data', line => {
				// console.log("[stderr]");
				// console.log(line);
				store.commit('account/pushLog', {level:'Error',msg:line});
				callError(line);
			});
			command.on('error', error => {
				console.log("[error]");
				store.commit('account/pushLog', {level:'Error',msg:error});
				callError(error);
			});
			let child = await command.spawn();
			console.log(child)
			store.commit('account/setPid', child.pid);
			console.log(`account/setPid=${child.pid}`)
			store.commit('account/setChild', child);
		}
	}
	async pausePipy (port){
		const pm = platform();
		if(pm != "android" && pm != "ios"){
			let child = store.getters['account/child'];
			let pid = localStorage.getItem("PID");
			console.log(`PID=${pid}`)
			if(!!child){
				child.kill();
			}
			if(!!pid){
				const findChild = new Child(pid*1);
				findChild.kill();
				const findChild2 = new Child(pid*1+1);
				findChild2.kill();
				const command = Command.create("kill", [`${pid*1}`]);
				command.execute();
				const command2 = Command.create("kill", [`${pid*1+1}`]);
				command2.execute();
			}
			store.commit('account/setPid', null);
			console.log('[paused pipy]');
		} else {
			await relaunch();
		}
	}
}
