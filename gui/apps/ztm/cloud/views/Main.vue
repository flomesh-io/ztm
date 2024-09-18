<script setup>
import { ref, onMounted,onActivated, computed,watch } from "vue";
import Files from './Files.vue'
import Queue from './Queue.vue'
import Preview from './Preview.vue'
import FileService from '../service/FileService';

const visibleEditor = ref(false);
const fileService = new FileService();
const path = ref('');
const selectedFile = ref();
const loading = ref(true);
const files = ref([]);
const endpoints = ref([]);
const uploads = ref([]);
const downloads = ref([]);
const getDownloads = () => {
	fileService.getDownloads().then((res)=>{
		downloads.value = res || [];
		if(downloads.value.length>0){
			setTimeout(()=>{
				getDownloads();
			},1000)
		}
	})
}
const getUploads = () => {
	fileService.getUploads().then((res)=>{
		uploads.value = res || [];
	})
}
const getFiles = () => {
	
	loading.value = true;
	fileService.getFiles(path.value).then((res)=>{
		files.value = res?.list|| [];
		loading.value = false;
	}).catch(()=>{
		setTimeout(()=>{
			getFiles();
		},1000)
	})
}

const loaddata = () => {
	getFiles();
	getDownloads();
	// getUploads();
}

const getEndpoints = (endpoint) => {
	fileService.getEndpoints().then((res)=>{
		endpoints.value = res || [];
	})
}
const changePath = (p) => {
	path.value = p;
	loaddata();
}
const save = () => {
	loaddata();
}
const downloadChange = (downloadFiles) => {
	visibleEditor.value = true;
	downloads.value = downloads.value.concat(downloadFiles);
	setTimeout(()=>{
		getDownloads();
	},1000)
	
}
// const uploadChange = (uploadFiles) => {
// 	visibleEditor.value = true;
// 	uploads.value = uploads.value.concat(uploadFiles);
// 	setTimeout(()=>{
// 		getUploads();
// 	},1000)
// }
const queueSize = computed(()=> downloads.value.length );

const visiblePreview = ref(false);
const previewItem = ref({});
const dir = ref('');
const openPreview = ({item, localDir}) => {
	dir.value = localDir;
	previewItem.value = item;
	visiblePreview.value = true;
	visibleEditor.value = false;
}
onMounted(()=>{
	getEndpoints();
})
onActivated(()=>{
	getEndpoints();
})
</script>

<template>
	<div class="flex flex-row min-h-screen" >
		<div class="h-full" style="flex:2" :class="{'flex-item':(!!visibleEditor),'flex-item':(!visibleEditor),'mobile-hidden':(!!visibleEditor)}">
			<Files 
				:queueSize="queueSize"
				:files="files" 
				:endpoints="endpoints"
				:loading="loading"
				:small="visibleEditor?'queue':(visiblePreview?'preview':'')" 
				@upload="()=>{}" 
				@download="downloadChange" 
				@preview="openPreview"
				@load="changePath"/>
		</div>
		<div class="flex-item h-full shadow" v-if="!!visiblePreview">
			<div class="mobile-fixed h-full">
				<Preview
					:item="previewItem"
					:dir="dir"
					@back="() => {previewItem=null;visiblePreview=false;}"/>
			</div>
		</div>
		<div class="flex-item h-full shadow" v-if="!!visibleEditor">
			<div class="mobile-fixed h-full">
				<Queue
					:downloads="downloads"
					@load="getDownloads()"
					@back="() => {selectedFile=null;visibleEditor=false;}"/>
			</div>
		</div>
		
	</div>
</template>

<style scoped lang="scss">
</style>