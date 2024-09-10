<script setup>
import { ref, computed } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import { copyFile, BaseDirectory } from '@tauri-apps/plugin-fs';
import { platform } from '@/utils/platform';
import { homeDir, documentDir } from '@tauri-apps/api/path';
import { usePrimeVue } from 'primevue/config';
import { writeFile } from '@/utils/file';
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
		default: true
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
const pm = computed(() => platform());
const importTargets = ref([]);
const choose = () => {

	const options = {
		multiple: props.multiple,
	}
	if(pm.value == 'ios' || pm.value == 'android'){
		documentDir().then((dir)=>{
			options.defaultPath = dir;
			openDialog(options, dir)
		})
	} else if(!!pm.value){
		documentDir().then((dir)=>{
			options.defaultPath = dir;
			openDialog(options, dir)
		})
	} else {
		openDialog(options);
	}
}
const openDialog = (options, dir) => {
	open(options).then((selected)=>{
		if (Array.isArray(selected)) {
			// user selected multiple files
			let saved = 0;
			uploading.value = true;
			toast.add({ severity: 'contrast', summary: 'Copying', group: 'import' });
			selected.forEach((file)=>{
				const _file_ary = file.split("/");
				const _name = _file_ary[_file_ary.length-1];
				const _target = `${props?.path || dir}/${_name}`;
				importTargets.value.push(_target);
				//BaseDirectory.Home
				copyFile(file, _target, { fromPathBaseDir: BaseDirectory.Document, toPathBaseDir: BaseDirectory.Document }).then(()=>{
					saved++;
					if(saved == selected.length){
						emits('saved', {});
						uploading.value = false;
					}
				});
			})
		} else if (selected === null) {
			// user cancelled the selection
		} else {
			// user selected a single file
		}
	})
}
// web file
const totalSize = ref(0);
const totalSizePercent = ref(0);
const files = ref([]);
const uploading = ref(false);

const $primevue = usePrimeVue();
const formatSize = (bytes) => {
    const k = 1024;
    const dm = 3;
    const sizes = $primevue.config.locale.fileSizeTypes;

    if (bytes === 0) {
        return `0 ${sizes[0]}`;
    }

    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const formattedSize = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));

    return `${formattedSize} ${sizes[i]}`;
};
const onSelectedFiles = (event) => {
    files.value = event.files;
    files.value.forEach((file) => {
        totalSize.value += parseInt(formatSize(file.size));
    });
};
const customUploader = async (event) => {
		uploading.value = true;
		importTargets.value = [];
		toast.add({ severity: 'contrast', summary: 'Copying', group: 'import' });
		let _val = props.modelValue || '';
		let saved = 0;
		if(event.files.length>0) {
			documentDir().then((dir)=>{
				event.files.forEach((_file)=>{
					const _target = `${props?.path || dir}/${_file?.name}`;
					importTargets.value.push(_target);
					writeFile(_file,_target,()=>{
						saved++;
						if(saved == event.files.length){
							emits('saved', {});
							uploading.value = false;
						}
					});
				})
			})
		}
};
const hasTauri = ref(!!window.__TAURI_INTERNALS__ || true);

//&& pm != 'ios' && pm != 'android'
</script>

<template>
	
	<Button v-if="!!hasTauri " severity="secondary" v-tooltip="props.placeholder" size="small" :icon="props.icon" :class="props.class"  @click="choose"></Button>
	<FileUpload 
		v-else
		:class="props.class" 
		severity="secondary"
		v-tooltip="uploading?'Importing':props.placeholder"
		:chooseLabel="null"
		mode="basic" 
		name="demo[]" 
		:multiple="props.multiple" 
		:maxFileSize="props.maxFileSize" 
		@select="onSelectedFiles"  
		@uploader="customUploader"
		:auto="true" 
		:disabled="props.disabled || uploading" 
		customUpload>
		<template #chooseicon>
			<i class="pi pi-spin pi-spinner"></i>
		</template>
		<template #uploadicon>
			<i :class="props.icon"></i>
		</template>
	</FileUpload>
	<Toast  position="bottom-center" group="import" @close="onClose">
			<template #message="slotProps">
					<div class="flex flex-column align-items-start" style="flex: 1">
							<div class="flex align-items-center gap-2">
								<i v-if="!uploading" class="iconfont icon-check text-green-500 text-2xl" />
								<i v-else class="pi pi-spin pi-spinner text-2xl" />
								<span class="font-bold text-900 text-white">{{importTargets}} {{uploading?'Importing':'Import successful'}}</span>
							</div>
							<ProgressBar v-if="uploading" class="w-full mt-1" mode="indeterminate" style="height: 6px; "></ProgressBar>
					</div>
			</template>
	</Toast>
</template>

<style scoped lang="scss">
	:deep(.p-button-label){
		display: none;
	}
	:deep(.p-message){
		position: fixed;
		left: 30%;
		top: 50px;
		right: 30%;
	}
	
</style>