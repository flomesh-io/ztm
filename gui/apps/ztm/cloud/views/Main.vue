<script setup>
import { ref, onMounted,onActivated, computed,watch } from "vue";
import Files from './Files.vue'
import Download from './Download.vue'
import FileService from '../service/FileService';

const visibleEditor = ref(false);
const fileService = new FileService();
const save = (file) => {
	loaddata(file);
}
const endpointMap = ref({});
onMounted(()=>{
	loaddata()
})
const loaddata = (file) => {
	getFiles(file);
}
const selectedFile = ref();
const loading = ref(false);
const loader = ref(false);
const error = ref();
const files = ref([]);
const getFiles = (file) => {
	
	loading.value = true;
	loader.value = true;
	setTimeout(()=>{
		loading.value = false;
		setTimeout(() => {
			loader.value = false;
		},1000)
		files.value = [
			'users/',
			'root/',
			'video.mp4',
			'readme.txt',
			'readme.md',
			'aaa.xls',
			'bbb.xlsx',
			'bbb.xlsx',
			'ccc.doc',
			'ddd.docx',
			'eee.zip',
			'fff.tar',
			'ggg.rar',
			'hhh.ppt',
			'iii.pdf',
			'jjj.mp3',
			'kkk.xxx',
			'p1.jpg',
			'p2.jpeg',
			'p3.png',
			'p4.bmp',
			'p5.gif',
		];
	},500)
	// endpointMap.value = {};
	// tunnelService.getTunnels((_tunnels,_eps)=>{
	// 	console.log("tunnels:")
	// 	console.log(_tunnels)
	// 	loading.value = false;
	// 	setTimeout(() => {
	// 		loader.value = false;
	// 	},2000)
	// 	error.value = null;
	// 	tunnels.value = _tunnels || [];
	// 	_eps.forEach((ep) => {
	// 		endpointMap.value[ep.id] = ep;
	// 	})
	// 	if(!!tunnel){
	// 		const _find = tunnels.value.find((_t) => _t.name == tunnel.name && _t.proto == tunnel.proto)
	// 		if(!!_find){
	// 			selectedTunnel.value = _find;
	// 			visibleEditor.value = true;
	// 		} else {
	// 			selectedTunnel.value = null;
	// 			visibleEditor.value = false;
	// 		}
	// 	}
	// })
}

const downloads = ref([
	{
		"name": "file1.zip",
		"sources": ["86540a10-576d-47d1-8d9f-e0184830f152"],
		"path": "/users/root/89.mp4",
		"state":"missing",
		"size":1024*1024,
		"time": 1724328877486,
		"hash": "48effab79269626be8604ad98e394a4f2ed2850fce79abfa6e49975d147464f" ,
		"downloading":0.931241211
	},
	{
		"name": "file2.zip",
		"sources": ["86540a10-576d-47d1-8d9f-e0184830f152"],
		"path": "/users/root/89.mp4",
		"state":"missing",
		"size":1024*1024,
		"time": 1724328877486,
		"hash": "48effab79269626be8604ad98e394a4f2ed2850fce79abfa6e49975d147464f" ,
		"downloading":0.931241211
	},
])
</script>

<template>
	<div class="flex flex-row min-h-screen" >
		<div class="h-full" style="flex:2" :class="{'flex-item':(!!visibleEditor),'flex-item':(!visibleEditor),'mobile-hidden':(!!visibleEditor)}">
			<Files 
				:downloadSize="downloads.length"
				:files="files" 
				:error="error" 
				:loading="loading"
				:loader="loader"
				:small="visibleEditor" 
				@create="() => visibleEditor = true" 
				@load="loaddata"
				@edit="(file) => {visibleEditor = true;selectedFile = file}"/>
		</div>
		<div class="flex-item h-full shadow" v-if="!!visibleEditor">
			<div class="mobile-fixed h-full">
				<Download
					:endpointMap="endpointMap"
					:downloads="downloads"
					@save="save" 
					@back="() => {selectedFile=null;visibleEditor=false;}"/>
			</div>
		</div>
	</div>
</template>

<style scoped lang="scss">
</style>