<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { merge } from '@/service/common/request';
import FileService from '../service/FileService';
import { useRoute } from 'vue-router'
import { useToast } from "primevue/usetoast";
import { platform } from '@/utils/platform';
import { useStore } from 'vuex';
import { checker, bitUnit, openFile, isImage, saveFile } from '@/utils/file';
import _ from "lodash"
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
const props = defineProps(['item','dir']);
const emits = defineEmits(['back','load']);
const store = useStore();
const route = useRoute();
const toast = useToast();
const fileService = new FileService();
const info = computed(() => {
	return store.getters['app/info']
});
const loading = ref(false);

const enabled = computed(() => {
	return true;
});
const error = ref();
const back = () => {
	emits('back')
}
const loaddata = () => {
	emits('load')
}

onMounted(() => {
});

const saving = ref(false);
const saveAs = () => {
	if(props?.item?.fileUrl){
		base({
			app:'ztmDownloads',
			fileUrl: props.item.fileUrl,
			before: ()=>{
				saving.value = true;
			},
			after: ()=>{
				saving.value = false;
				toast.add({ severity: 'success', summary:t('Tips'), detail: t('Saved.'), life: 3000 });
			}
		})
	}
}

const hasTauri = ref(!!window.__TAURI_INTERNALS__);
const moreMenu = ref();
const moreItems = computed(()=>{
	const actions = [
	];
	if(!!hasTauri.value){
		actions.push({
			label: (platform() == 'ios' || platform() == 'android')?'Share':'Open',
			command(){
				openFile(`${props?.dir}${props?.item?.path}`);
			}
		})
	}
	if(platform() != 'ios'){
		actions.push({
				label: 'Save As',
				command(){
					saveAs()
				}
		})
	}
	return actions
});
const open = () => {
	openFile(`${props?.dir}${props?.item?.path}`);
}
const moreToggle = (event) => {
    moreMenu.value.toggle(event);
};
</script>

<template>

	<div class="surface-ground h-full min-h-screen relative">
		<AppHeader :back="back">
				<template #center>
					 <b>{{props?.item?.name}}</b> 
				</template>
				<template #end> 
					<Button v-tooltip="'Save As'" icon="pi pi-save" @click="saveAs" :severity="'secondary'" aria-haspopup="true" aria-controls="more_menu">
					</Button>
					<Button v-tooltip="'Open'" icon="pi pi-external-link" @click="open" :severity="'secondary'" aria-haspopup="true" aria-controls="more_menu">
					</Button>
					<!-- <Button v-if="!props.d" :loading="loading" :disabled="!enabled" label="Create" aria-label="Submit" size="small" @click="createTunnel"/> -->
				</template>
		</AppHeader>
		<Menu ref="moreMenu" id="more_menu" :model="moreItems" :popup="true" />
		<ScrollPanel class="absolute-scroll-panel" style="bottom: 0;">
			<FilePreview v-if="props?.item?.fileUrl" class="w-full" :file="props.item" />
			<Empty v-else />
		</ScrollPanel>
	</div>
</template>

<style scoped lang="scss">
	:deep(.p-tabview-panels){
		background-color: transparent;
	}
</style>
