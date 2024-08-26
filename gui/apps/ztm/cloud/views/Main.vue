<script setup>
import { ref, onMounted,onActivated, computed,watch } from "vue";
import Files from './Files.vue'
import FileEditor from './FileEditor.vue'
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
	endpointMap.value = {};
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
</script>

<template>
	<div class="flex flex-row min-h-screen" >
		<div class="h-full" :class="{'w-24rem':(!!visibleEditor),'flex-item':(!visibleEditor),'mobile-hidden':(!!visibleEditor)}">
			<Files 
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
				<FileEditor
					:title="selectedFile?`${selectedFile?.proto}/${selectedFile?.name}`:null"
					:d="selectedFile" 
					:endpointMap="endpointMap"
					@save="save" 
					@back="() => {selectedFile=null;visibleEditor=false;}"/>
			</div>
		</div>
	</div>
</template>

<style scoped lang="scss">
</style>