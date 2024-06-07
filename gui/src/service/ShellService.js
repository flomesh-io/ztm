import { Command, Child, open } from '@tauri-apps/plugin-shell';
import { invoke } from '@tauri-apps/api/core';
import { resourceDir, appLogDir, appDataDir, appLocalDataDir } from '@tauri-apps/api/path';
import { platform } from '@tauri-apps/plugin-os';
import { readTextFileLines, BaseDirectory } from '@tauri-apps/plugin-fs';
import PipyProxyService from '@/service/PipyProxyService';
import { relaunch } from "@tauri-apps/plugin-process";
import store from "@/store";

const pipyProxyService = new PipyProxyService();
export default class ShellService {
	async getDB () {
		const appDataDirPath = await resourceDir();
		return `${appDataDirPath}/ztm.db`
	}
	async openFinder() {
		const appDataDirPath = await resourceDir();
		open(appDataDirPath)
	}
	async loadLog() {
		const pm = await platform();
		if(pm == "android"){
			const resourceDirPath = await resourceDir();
			const lines = await readTextFileLines('ztm.log', { baseDir: BaseDirectory.Resource });
			const logs = []
			for await (const line of lines) {
				if(line.indexOf("[INF]")>=0){
					logs.push({level:'Info',msg:line});
				} else {
					logs.push({level:'Error',msg:line});
				}
			}
			store.commit('account/setLogs', logs);
		}
	}
	async takePipyVersion (apiGet) {
		const pm = await platform();
		store.commit('account/setPlatform', pm);
		console.log("takePipyVersion");
		if(pm != "android"){
			let command = await Command.sidecar("bin/cli", ['version','--json','','','','']);
			await command.spawn();
			command.stdout.on('data', line => {
				console.log(line)
				//{"ztm":{"version":"v0.0.2","commit":"a73787b37cb500044410325b04558d2507a847f7","date":"Sat, 18 May 2024 18:55:27 +0800"},"pipy":{"version":"1.1.0-33","commit":"bd7450a98c9513394869493753456944aa26c1f7","date":"Sat, 18 May 2024 18:10:58 +0800"}}
				store.commit('account/setVersion', !!line ? JSON.parse(line) : {});
			});
		} else if(!!apiGet){
			pipyProxyService.getVersion()
				.then(res => {
					if(!!res){
						console.log(res)
						store.commit('account/setVersion', res);
					}
				})
				.catch(err => {
				}); 
		}
	}
	async startPipy (port, reset, callError){
		const resourceDirPath = await resourceDir();
		localStorage.setItem("VITE_APP_API_PORT", port);
		// const appLogDirPath = await appLogDir();
		// `${resourceDirPath}/_up_/_up_/agent/main.js`,
		const pm = await platform();
		if(pm != "android"){
			
			const args = [
				"run",
				"agent",
				`--listen=${port}`,
				`--database=${resourceDirPath}/ztm.db`,
				"--pipy-options",
				`--log-file=${resourceDirPath}/ztm.log`,
			];
			
			await this.pausePipy(port);
			console.log(`[starting pipy:${args}]`);
			const command = Command.sidecar("bin/cli", args);
			command.on('close', data => {
				console.log("[close]");
				console.log(data);
				store.commit('account/pushLog', {level:'Info',msg:`pipy pause with code ${data.code} and signal ${data.signal}`});
			});
			command.stdout.on('data', line => {
				console.log("[data]");
				store.commit('account/pushLog', {level:'Info',msg:line});
			});
			command.stderr.on('data', line => {
				console.log("[data]");
				store.commit('account/pushLog', {level:'Error',msg:line});
				callError(line);
			});
			command.on('error', error => {
				console.log("[error]");
				store.commit('account/pushLog', {level:'Error',msg:error});
				callError(error);
			});
			let child = await command.spawn();
			store.commit('account/setPid', child.pid);
			store.commit('account/setChild', child);
		} else {
			const args = [
				"./main",
				"--pipy",
				"repo://ztm/agent",
				"--args",
				`--listen=${port}`,
				`--database=${resourceDirPath}/ztm.db`,
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
		}
	}
	async pausePipy (port){
		const pm = await platform();
		if(pm != "android"){
			let child = store.getters['account/child'];
			let pid = localStorage.getItem("PID");
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
