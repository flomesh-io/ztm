<template>
	<div style="top: 0;position: fixed;bottom: 0;left: 0;right: 0;background: rgba(50, 4, 40, 1);">
		<Terminal
			style="height: 100%;"
			welcomeMessage="Welcome to ztm cli"
			prompt="ztm $"
			aria-label="ztm cli"
		/>
	</div>
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue';
import TerminalService from "primevue/terminalservice";
import { Command } from '@tauri-apps/plugin-shell';

onMounted(() => {
    TerminalService.on('command', commandHandler);
})

onBeforeUnmount(() => {
    TerminalService.off('command', commandHandler);
})

const commandHandler = (text) => {
	const args = text.split(" ");
	if(args.length<6){
		const size = 6-args.length;
		for(let i=0;i<size;i++){
			args.push('')
		}
		args.forEach((arg,i)=>{
			args[i] = arg.replaceAll(/—/g,"--");
		})
	}
	commandHandlerCore(args);
}
const commandHandlerCore = async (args) => {
	console.log(args)
	let command = await Command.sidecar("bin/cli", args);
	await command.spawn();
	let rst = ""
	command.stdout.on('data', line => {
		console.log(line)
		rst += line;
		TerminalService.emit('response', rst);
	});
}

</script>
