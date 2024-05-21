<script setup>
import { ref, onMounted,onActivated,watch, computed } from "vue";
import { useRouter } from 'vue-router'
import PipyProxyService from '@/service/PipyProxyService';
import MeshSelector from './common/MeshSelector.vue'
import { useStore } from 'vuex';
import { useConfirm } from "primevue/useconfirm";
import dayjs from 'dayjs';
import _ from 'lodash';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime)

const store = useStore();
const router = useRouter();
const pipyProxyService = new PipyProxyService();
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
onActivated(()=>{
	loaddata();
})
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
	loading.value = true;
	loader.value = true;
	pipyProxyService.getEndpoints(selectedMesh.value?.name)
		.then(res => {
			endpoints.value = res || [];
			if(!!selectedMesh.value?.agent?.id){
				selectEndpoints.value = [ selectedMesh.value.agent.id ];
			}
			mergeLogs();
		})
		.catch(err => console.log('Request Failed', err)); 
}
const getLogs = (ep) => {
	pipyProxyService.getLogs(selectedMesh.value?.name, ep)
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
const active = ref(0);
const severityMap = computed(() => (severity) => {
	if(severity == 'error'){
		return "danger";
	} else if(severity == 'warn'){
		return "warning";
	} else if(severity == 'debug'){
		return "contrast";
	} else {
		return severity;
	}
})
const timeago = computed(() => (ts) => {
	if(!!ts){
		const date = new Date(ts);
		return dayjs(date).fromNow();
	} else {
		return "None";
	}
})
</script>

<template>
	<Card class="nopd ml-3 mr-3 mt-3">
		<template #content>
			<InputGroup class="search-bar" >
				<Button :disabled="!typing" icon="pi pi-search" :label="selectedMesh?.name" />
				<Textarea @keyup="watchEnter" v-model="typing" :autoResize="true" class="drak-input bg-gray-900 text-white flex-1" placeholder="Type keywork" rows="1" cols="30" />
			</InputGroup>
		</template>
	</Card>
	<div v-if="!!endpoints && endpoints.length>0" class="mt-3 flex text-center justify-content-center align-content-center">
		<Label class="px-3" style="padding-top: 10px;"><b>Endpoints:</b></Label>
		<SelectButton class="small" @change="mergeLogs" v-model="selectEndpoints" :options="endpoints" optionLabel="name" optionValue="id" multiple aria-labelledby="multiple" />
	</div>
	<Loading v-if="loading"/>
	<div v-else-if="logsFilter && logsFilter.length >0" class="text-center">
		<div class="grid text-left px-5 py-5" >
			<DataTable class="w-full" :value="logsFilter" tableStyle="min-width: 50rem">
				
				<Column header="Time">
					<template #body="slotProps">
						{{timeago(slotProps.data.time)}}
					</template>
				</Column>
				<Column header="Endpoint">
					<template #body="slotProps">
						{{endpoints.find((n)=>n.id == slotProps.data.ep)?.name}}
					</template>
				</Column>
				<Column header="Type">
					<template #body="slotProps">
						<Tag :severity="severityMap(slotProps.data.type)">{{slotProps.data.type}}</Tag>
					</template>
				</Column>
				
				<Column header="Message">
					<template #body="slotProps">
						{{slotProps.data.message}}
					</template>
				</Column>
			</DataTable>
		</div>
	</div>
	<Empty v-else />
</template>

<style scoped lang="scss">
:deep(.p-dataview-content) {
  background-color: transparent !important;
}
:deep(.p-tabview-nav),
:deep(.p-tabview-panels),
:deep(.p-tabview-nav-link){
	background: transparent !important;
}
</style>