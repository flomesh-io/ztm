<script setup>
import { ref, computed } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import { platform } from '@/utils/platform';
import toast from "@/utils/toast";

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
const pm = computed(() => platform())
const choose = () => {
	if(pm.value == 'ios' || pm.value == 'android'){
		toast.add({ severity: 'contrast', summary: 'Tips', detail: `Cannot be modified, fixed in the Files App: /ztm folder.`, life: 3000 });
	} else {
		const options = {
			directory: true,
			multiple: false,
		}
		if(props.path){
			options.defaultPath = props.path;
		}
		open(options).then((selected)=>{
			emits('select', selected);
		})
	}
}
</script>

<template>
	
	<Button v-tooltip="props.placeholder" size="small" :icon="props.icon" :class="props.class"  @click="choose"></Button>
	
</template>

<style scoped lang="scss">
</style>