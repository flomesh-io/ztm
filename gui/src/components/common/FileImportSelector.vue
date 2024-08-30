<script setup>
import { ref, computed } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import { copyFile, BaseDirectory } from '@tauri-apps/plugin-fs';
import { homeDir } from '@tauri-apps/api/path';

const props = defineProps({
	class: {
		type: String,
		default: ''
	},
	icon: {
		type: String,
		default: 'pi pi-folder-open'
	},
	path: {
		type: String,
		default: ''
	},
	accept: {
		//json/*,image/*,application/pdf,audio/*,video/*,text/plain,text/csv,text/html
		type: String,
		default: 'application/json,text/plain,text/csv,text/html'
	},
	placeholder: {
		type: String,
		default: ''
	},
	multiple: {
		type: Boolean,
		default: false
	},
	disabled: {
		type: Boolean,
		default: false
	},
	msg: {
		type: String,
		default: ''
	},
	fileLimit: {
		type: Number,
		default: 1
	},
	maxFileSize: {
		type: Number,
		default: 30000000
	},
	modelValue: {
		type: [String, Array],
		default: ''
	}
});

const emits = defineEmits(['select']);

const choose = () => {
	homeDir().then((dir)=>{
		const options = {
			multiple: true,
		}
		options.defaultPath = dir;
		open(options).then((selected)=>{
			if (Array.isArray(selected)) {
			  // user selected multiple files
				let saved = 0;
				selected.forEach((file)=>{
					debugger
					const _name = file.name;
					copyFile(file.path, `${props.path}/${_name}`, { fromPathBaseDir: BaseDirectory.Home, toPathBaseDir: BaseDirectory.Home }).then(()=>{
						saved++;
						if(saved == selected.length){
							emits('saved', {});
						}
					});
				})
			} else if (selected === null) {
			  // user cancelled the selection
			} else {
			  // user selected a single file
			}
		})
	})
}
</script>

<template>
	
	<Button text severity="secondary" v-tooltip="props.placeholder" size="small" :icon="props.icon" :class="props.class"  @click="choose"></Button>
	
</template>

<style scoped lang="scss">
</style>