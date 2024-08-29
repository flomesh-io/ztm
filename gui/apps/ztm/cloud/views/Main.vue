<script setup>
import { ref, onMounted,onActivated, computed,watch } from "vue";
import Files from './Files.vue'
import Queue from './Queue.vue'
import FileService from '../service/FileService';

const visibleEditor = ref(false);
const fileService = new FileService();
const path = ref('');
const selectedFile = ref();
const loading = ref(false);
const loader = ref(false);
const error = ref();
const files = ref([]);
// [
// 	{
// 		"name": "file1.zip",
// 		"sources": ["86540a10-576d-47d1-8d9f-e0184830f152"],
// 		"path": "/users/root/89.mp4",
// 		"state":"missing",
// 		"size":1024*1024,
// 		"time": 1724328877486,
// 		"hash": "48effab79269626be8604ad98e394a4f2ed2850fce79abfa6e49975d147464f" ,
// 		"downloading":0.931241211
// 	},
// ]
const uploads = ref([]);
const downloads = ref([]);
const getDownloads = () => {
	fileService.getDownloads().then((res)=>{
		downloads.value = res;
	})
}
const getUploads = () => {
	fileService.getUploads().then((res)=>{
		uploads.value = res;
	})
}
const getFiles = () => {
	
	loading.value = true;
	loader.value = true;
	fileService.getFiles(path.value).then((res)=>{
		files.value = res;
		loading.value = false;
		setTimeout(() => {
			loader.value = false;
		},1000)
	})
}

const loaddata = () => {
	getFiles();
	getDownloads();
	getUploads();
}
const changePath = (p) => {
	path.value = p;
	loaddata();
}
const save = () => {
	loaddata();
}
const downloadChange = () => {
	visibleEditor.value = true;
	getDownloads();
}
const uploadChange = () => {
	visibleEditor.value = true;
	getUploads();
}
onMounted(()=>{
	loaddata()
})
</script>

<template>
	<div class="flex flex-row min-h-screen" >
		<div class="h-full" style="flex:2" :class="{'flex-item':(!!visibleEditor),'flex-item':(!visibleEditor),'mobile-hidden':(!!visibleEditor)}">
			<Files 
				:cloudSize="downloads.length + uploads.length"
				:files="files" 
				:error="error" 
				:loading="loading"
				:loader="loader"
				:small="visibleEditor" 
				@upload="uploadChange" 
				@download="downloadChange" 
				@load="changePath"/>
		</div>
		<div class="flex-item h-full shadow" v-if="!!visibleEditor">
			<div class="mobile-fixed h-full">
				<Queue
					:uploads="uploads"
					:downloads="downloads"
					@back="() => {selectedFile=null;visibleEditor=false;}"/>
			</div>
		</div>
	</div>
</template>

<style scoped lang="scss">
</style>