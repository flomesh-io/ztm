import { Command, Child, open } from '@tauri-apps/plugin-shell';
import { resourceDir, appLogDir, appDataDir } from '@tauri-apps/api/path';
import { platform } from '@tauri-apps/plugin-os';
import store from "@/store";

export default class ShellService {
	async getDB () {
		const appDataDirPath = await resourceDir();
		console.log(`[appDataDirPath]:${appDataDirPath}`);
		return `${appDataDirPath}/ztm.db`
	}
	async takePipyVersion () {
		console.log("takePipyVersion");
		let command = await Command.sidecar("bin/pipy", ['-v','','','','']);
		await command.spawn();
		command.stdout.on('data', line => {
			if(!!line && line.split(":")[0].trim() == 'Version'){
				store.commit('account/setPipyVersion', line.split(":")[1].trim());
			}
		});
	}
	async startPipy (port, reset, callError){
		await open('pipy');
		await this.pausePipy();
		const resourceDirPath = await resourceDir();
		localStorage.setItem("VITE_APP_API_PORT", port);
		// const appLogDirPath = await appLogDir();
		const db = await this.getDB();
		const args = [
			`${resourceDirPath}/_up_/_up_/agent/main.js`,
			"--skip-unknown-arguments",
			`--log-file=${resourceDirPath}/ztm.log`,
			`--listen=${port}`,
			`--database=${db}`,
		];
		if(reset){
			args.push("--reset");
		}
		console.log(`[starting pipy:${args}]`);
		const command = Command.sidecar("bin/pipy", args);
		command.on('close', data => {
			console.log(data);
			store.commit('account/pushLog', {level:'Info',msg:`pipy pause with code ${data.code} and signal ${data.signal}`});
		});
		command.stdout.on('data', line => {
			store.commit('account/pushLog', {level:'Info',msg:line});
		});
		command.stderr.on('data', line => {
			store.commit('account/pushLog', {level:'Error',msg:line});
			callError(line);
		});
		command.on('error', error => {
			store.commit('account/pushLog', {level:'Error',msg:error});
			callError(error);
		});
		let child = await command.spawn();
		store.commit('account/setPid', child.pid);
		store.commit('account/setChild', child);
	}
	async pausePipy (){
		let child = store.getters['account/child'];
		let pid = store.getters['account/pid'];
		if(!!child){
			child.kill();
			store.commit('account/setPid', null);
		}else if(!!pid){
			const findChild = new Child(pid*1);
			findChild.kill();
			store.commit('account/setPid', null);
		}
		console.log('[paused pipy]');
	}
}
