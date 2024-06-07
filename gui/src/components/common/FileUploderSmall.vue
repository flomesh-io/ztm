<script setup>
import { ref, computed } from 'vue';
import { usePrimeVue } from 'primevue/config';
import { useToast } from "primevue/usetoast";
// import { upload, remove } from '@/service/OOSService';
const toast = useToast();

const props = defineProps({
	class: {
		type: String,
		default: ''
	},
	path: {
		type: String,
		default: ''
	},
	accept: {
		type: String,
		default: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
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

const emits = defineEmits(['upload']);
const $primevue = usePrimeVue();

const uploadedLength = computed(() => {
	if(!props.modelValue){
		return 0;
	} else if(Array.isArray(props.modelValue)){
		return props.modelValue.length;
	} else {
		return 1;
	}
});
const totalSize = ref(0);
const totalSizePercent = ref(0);
const files = ref([]);

const onRemoveTemplatingFile = (file) => {
    totalSize.value -= parseInt(formatSize(file.size));
    totalSizePercent.value = totalSize.value / 10;
};

const onClearTemplatingUpload = (clear) => {
    clear();
    totalSize.value = 0;
    totalSizePercent.value = 0;
};

const onSelectedFiles = (event) => {
    files.value = event.files;
    files.value.forEach((file) => {
        totalSize.value += parseInt(formatSize(file.size));
    });
};

const uploadEvent = (callback) => {
    totalSizePercent.value = totalSize.value / 10;
    callback();
};

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
const customUploader = async (event) => {
		uploading.value = true;
		toast.add({ severity: 'contrast', summary: 'Uploading', group: 'bc' });
		let _val = props.modelValue || '';
		if(props.multiple){
			//no multiple
		} else if(event.files.length>0) {
			_val =  event.files[0];
			const reader = new FileReader();
			reader.onload = function(event) {
			  const text = event.target.result; 
				emits('upload',event.target.result)
			};
			reader.readAsText(_val);
			setTimeout(()=>{
				// TODO strapi upload (假设请求过程1秒)
				uploading.value = false;
			},1000)
		}
};
const uploading = ref(false);
</script>

<template>
	
	<FileUpload 
		v-if="!props.modelValue"
		:class="props.class" 
		severity="contrast"
		v-tooltip="uploading?'Importing':props.placeholder"
		:chooseLabel="null"
		mode="basic" 
		name="demo[]" 
		:multiple="props.multiple" 
		:maxFileSize="props.maxFileSize" 
		@select="onSelectedFiles"  
		@uploader="customUploader"
		:auto="!props.multiple" 
		:disabled="props.disabled || uploading" 
		customUpload>
		<template #chooseicon>
			<i class="pi pi-spin pi-spinner"></i>
		</template>
		<template #uploadicon>
			<slot />
		</template>
	</FileUpload>
	<Toast  position="bottom-center" group="bc" @close="onClose">
			<template #message="slotProps">
					<div class="flex flex-column align-items-start" style="flex: 1">
							<div class="flex align-items-center gap-2">
								<i v-if="!uploading" class="iconfont icon-check text-green-500 text-2xl" />
								<span class="font-bold text-900 text-white">{{uploading?'Importing':'Import successful'}}</span>
							</div>
							<ProgressBar v-if="uploading" class="w-full mt-1" mode="indeterminate" style="height: 6px; "></ProgressBar>
					</div>
			</template>
	</Toast>
</template>

<style scoped lang="scss">
	// :deep(.p-fileupload-choose-button){
	// 	color: #ffffff;
	// 	background: #020617;
	// 	border: 1px solid #020617;
	// 	height: 2.5rem;
	// }
	// :deep(.p-fileupload-choose-button:hover){
	// 	color: #ffffff;
	// 	background: #000 !important;
	// 	border: 1px solid #000 !important;
	// 	height: 2.5rem;
	// }
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