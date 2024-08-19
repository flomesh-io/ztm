<script setup>
import { ref, onMounted,onActivated,watch, computed } from "vue";
import { useRouter } from 'vue-router'
import ZtmService from '@/service/ZtmService';
import { useStore } from 'vuex';
import { useConfirm } from "primevue/useconfirm";
import _ from 'lodash';
import Log from './Log.vue'

const store = useStore();
const router = useRouter();
const ztmService = new ZtmService();
const confirm = useConfirm();
const loading = ref(false);
const loader = ref(false);
const status = ref({});
const logs = ref([])
const meshes = computed(() => {
	return store.getters['account/meshes']
});

const selectedMesh = computed(() => {
	return store.getters["account/selectedMesh"]
});
const loaddata = () => {
	
	loading.value = true;
	loader.value = true;
	getEndpoints();
}
const mergeLogs = () => {
	logs.value = [];
	selectEndpoints.value.forEach((ep)=>{
		getLogs(ep);
	})
}
const selectEndpoints = ref([]);
const endpoints = ref([]);
const getEndpoints = (callback) => {
	if(!selectedMesh.value){
		loading.value = false;
		loader.value = false;
		return
	}
	loading.value = true;
	loader.value = true;
	ztmService.getEndpoints(selectedMesh.value?.name)
		.then(res => {
			endpoints.value = res || [];
			if(!!selectedMesh.value?.agent?.id){
				selectEndpoints.value = [ selectedMesh.value.agent.id ];
			}
			mergeLogs();
		})
		.catch(err => {
			loading.value = false;
			loader.value = false;
		}); 
}
const getLogs = (ep) => {
	ztmService.getLogs(selectedMesh.value?.name, ep)
		.then(res => {
			loading.value = false;
			setTimeout(() => {
				loader.value = false;
			},2000)
			const _res = res;
			_res.forEach(item => item.ep = ep);
			logs.value = logs.value.concat(res || []);
			logs.value  = _.uniqBy(logs.value, item => `${item.ep}-${item.time}-${item.message}`);
			logs.value = _.sortBy(logs.value, item => item.time).reverse();
			
		})
		.catch(err => {
			loading.value = false;
			loader.value = false;
		}); 
}
const typing = ref('');
const logsFilter = computed(() => {
	return logs.value.filter((log)=>{
		return (typing.value == '' || log.message.indexOf(typing.value) >=0  || typing.value == log.type);
	})
});
watch(()=>selectedMesh,()=>{
	if(selectedMesh.value){
		loaddata();
	}
},{
	deep:true,
	immediate:true
})
const back = () => {
	router.go(-1)
}
onActivated(()=>{
	loaddata();
})
</script>

<template>
	<AppHeader :main="true" >
			<template #center>
				<b>Endpoint Logs</b>
			</template>
	
			<template #end> 
				<Button icon="pi pi-refresh" text @click="mergeLogs"  :loading="loading"/>
			</template>
	</AppHeader>
	<Card class="nopd">
		<template #content>
			<InputGroup class="search-bar" >
				<Button icon="pi pi-chart-scatter" />
				<MultiSelect  v-model="selectEndpoints" @change="mergeLogs" :options="endpoints" optionLabel="name" optionValue="id" :filter="endpoints.length>8" placeholder="Endpoints"
				            :maxSelectedLabels="2" style="max-width: 200px;" />
				<Textarea @keyup="watchEnter" v-model="typing" :autoResize="true" class="drak-input bg-gray-900 text-white flex-1" placeholder="Type keyword" rows="1" cols="30" />
				<Button :disabled="!typing" icon="pi pi-search"/>
			</InputGroup>
		</template>
	</Card>
	<Loading v-if="loading"/>
	<div v-else-if="logsFilter && logsFilter.length >0" class="text-center">
		<Log :d="logsFilter" :endpoints="endpoints"/>
	</div>
	<Empty v-else />
</template>
