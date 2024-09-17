<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { merge } from '@/service/common/request';
import FileService from '../service/FileService';
import { useRoute } from 'vue-router'
import { useToast } from "primevue/usetoast";
import { useStore } from 'vuex';
import { checker, bitUnit, openFile, isMirror, isImage, saveFile } from '@/utils/file';
import _ from "lodash"

const props = defineProps(['item','dir']);
const emits = defineEmits(['back','load']);
const store = useStore();
const endpoints = ref([]);
const users = ref([]);
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
	if(props?.item.fileUrl){
		saveFile(item.fileUrl,()=>{
			saving.value = true;
		},()=>{
			saving.value = false;
			toast.add({ severity: 'success', summary:'Tips', detail: 'Saved.', life: 3000 });
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
				label: 'Open',
				command(){
					openFile(`${props?.dir}${props?.item?.path}`);
				}
		})
	}
	
	actions.push({
			label: 'Save As',
			command(){
				saveAs()
			}
	})
	return actions
});

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
					<Button icon="pi pi-ellipsis-v" @click="moreToggle" :severity="'secondary'" aria-haspopup="true" aria-controls="more_menu">
					</Button>
					<!-- <Button v-if="!props.d" :loading="loading" :disabled="!enabled" label="Create" aria-label="Submit" size="small" @click="createTunnel"/> -->
				</template>
		</AppHeader>
		<Menu ref="moreMenu" id="more_menu" :model="moreItems" :popup="true" />
		<ScrollPanel class="absolute-scroll-panel" style="bottom: 0;">
			<FilePreview v-if="props?.item?.fileUrl" class="w-full" :src="props.item.fileUrl" />
			<Empty v-else />
		</ScrollPanel>
	</div>
</template>

<style scoped lang="scss">
	:deep(.p-tabview-panels){
		background-color: transparent;
	}
</style>
