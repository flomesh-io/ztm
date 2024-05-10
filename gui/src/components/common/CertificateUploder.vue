<script setup>
import { ref, computed } from 'vue';
import { usePrimeVue } from 'primevue/config';

const props = defineProps({
	accept: {
		type: String,
		default: '*/*'
	},
	placeholder: {
		type: String,
		default: ''
	},
	fileLimit: {
		type: Number,
		default: 1
	},
	maxFileSize: {
		type: Number,
		default: 1000
	},
	modelValue: {
		type: [String, Array],
		default: ''
	}
});

const emits = defineEmits(['update:modelValue']);
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

const onRemoveTemplatingFile = (file, removeFileCallback, index) => {
    removeFileCallback(index);
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

const onTemplatedUpload = () => {
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
    // const reader = new FileReader();
    // let blob = await fetch(file.objectURL).then((r) => r.blob()); 
    // reader.readAsDataURL(blob);
    // reader.onloadend = function () {
    //     const base64data = reader.result;
    // };
		let _val = props.modelValue || '';
		if(event.files.length>0) {
			_val =  event.files[0];
			const reader = new FileReader();
			reader.onload = function(event) {
			  const text = event.target.result; 
				emits('update:modelValue',event.target.result)
			};
			reader.readAsText(_val);
		}
		
};
const customRemoveUploadedFile = ({
	removeFileCallback, files
}) => {
	if(files.length>0){
		onRemoveTemplatingFile(files[0], removeFileCallback, 0);
	}
	emits('update:modelValue','');
}
const op = ref();
const toggle = (event) => {
	val.value = props.modelValue;
	op.value.toggle(event);
}
const val = ref();
const typeCancel = () => {
	op.value.hide();
}
const typeOk = () => {
	emits('update:modelValue',val.value);
	op.value.hide();
}
</script>

<template>
	<div :class="{'noheader-upload':!!props.modelValue}">
	<FileUpload :auto="!props.multiple" name="demo[]" customUpload @uploader="customUploader" :multiple="false" :maxFileSize="props.maxFileSize" @select="onSelectedFiles">
    <template #header="{ chooseCallback, uploadCallback, clearCallback, files }">
        <div class="w-full">
          <div class="flex flex-wrap justify-content-between align-items-center flex-1 gap-2" v-if="!props.modelValue">
						<div class="flex gap-2">
                <Button size="small" v-tooltip="'Select'" @click="chooseCallback" icon="pi pi-plus" rounded severity="warn"></Button>
                <Button size="small" v-tooltip="'Type'" @click="toggle" icon="pi pi-pencil" rounded  severity="secondary"></Button>
								<OverlayPanel ref="op">
									<Chip class="pl-0 pr-3 mb-2 align-items-top teatarea-panel w-30rem"  >
											<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
												<i class="pi pi-shield" />
											</span>
											<span class="font-medium">
												<Textarea :placeholder="props.placeholder" v-model="val" :autoResize="false" rows="8" />
											</span>
									</Chip>	
									<div class="flex justify-content-end">
										<Button size="small" class="mr-2" label="Cancel" @click="typeCancel" severity="secondary"></Button>
										<Button size="small" label="Ok" @click="typeOk"  severity="success"></Button>
									</div>
								</OverlayPanel>
						</div>
            <ProgressBar :value="totalSizePercent" :showValue="false" :class="['md:w-10rem h-1rem w-full md:ml-auto', { 'exceeded-progress-bar': totalSizePercent > 100 }]"
                ><span class="white-space-nowrap">{{ totalSize }}B / 1Mb</span></ProgressBar
            >
					</div>
        </div>
    </template>
    <template #content="{ files, uploadedFiles, removeUploadedFileCallback, removeFileCallback }">
        <div v-if="!!props.modelValue">
            <div class="flex flex-wrap p-0 gap-5">
                <div class="flex flex-column align-items-left gap-3">
                    <Chip  severity="success" >
											<i class="pi pi-verified text-green-600 text-xl mr-2" />Configured
											<span v-tooltip="'Clear'" class="ml-2 font-medium pointer" @click="customRemoveUploadedFile({files,removeFileCallback})">
												<i class="pi pi-times-circle relative text-gray-500" style="top: 1px;" />
											</span>
										</Chip>
                </div>
            </div>
        </div>
    </template>
    <template #empty="{ chooseCallback }">
        <div v-if="!props.modelValue" class="flex align-items-center justify-content-center flex-column">
            <i class="pi pi-file-arrow-up pt-2 pb-4 text-6xl text-400 border-400 text-gray-300" />
            <p class="mb-2 text-gray-500">Drag and drop to here.</p>
        </div>
    </template>
	</FileUpload>
	</div>
</template>

<style scoped lang="scss">
</style>