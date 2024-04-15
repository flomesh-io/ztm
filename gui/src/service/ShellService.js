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
	async getPipy () {
		// const isDev = import.meta.env.DEV;
		// const plm = await platform();
		// linux、macos、ios、freebsd、dragonfly、netbsd、openbsd、solaris、android、windows
		// const resourceDirPath = await resourceDir();
		///Users/lindongchen/Documents/HBuilderProjects/ztm/gui/src-tauri/target/debug/bin/macos/pipy
		return `bin/pipy`;
	}
	async takePipyVersion () {
		console.log("takePipyVersion");
		let result = await Command.sidecar("bin/pipy", ['-v']).execute();
		console.log(result);
		if(result?.code == 0){
			const _v = result?.stdout.split("\n")[0].split(":")[1].trim();
			store.commit('account/setPipyVersion', _v);
		}
	}
	async startPipy (port, reset){
		await this.pausePipy();
		const resourceDirPath = await resourceDir();
		localStorage.setItem("VITE_APP_API_PORT", port);
		// const appLogDirPath = await appLogDir();
		//pipy ../agent/main.js --log-file=../ztm_log.txt --skip-unknown-arguments --listen=6666 --database=~/ztm.db
		const db = await this.getDB();
		const args = [
			`${resourceDirPath}/agent/main.js`,
			`--log-file=${resourceDirPath}/ztm.log`,
			"--skip-unknown-arguments",
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
			console.log(`pipy pause with code ${data.code} and signal ${data.signal}`)
		});
		command.stdout.on('data', line => console.log(`command stdout: "${line}"`));
		command.stderr.on('data', line => console.log(`command stderr: "${line}"`));
		command.on('error', error => console.error(`command error: "${error}"`));
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
