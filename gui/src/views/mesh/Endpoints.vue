<script setup>
import { ref, onMounted,onActivated, computed } from "vue";
import { useRouter } from 'vue-router'
import PipyProxyService from '@/service/PipyProxyService';
import MeshSelector from './common/MeshSelector.vue'
import store from "@/store";
import { useConfirm } from "primevue/useconfirm";
import freeSvg from "@/assets/img/free.svg";

const router = useRouter();
const pipyProxyService = new PipyProxyService();
const confirm = useConfirm();
const loading = ref(false);
const loader = ref(false);
const status = ref({});
const endpoints = ref([]);
const selectedMesh = ref(null);

const meshes = computed(() => {
	return store.getters['account/meshes']
});

onActivated(()=>{
	getEndpoints();
})
const load = (d) => {
	meshes.value = d;
}
const select = (selected) => {
	selectedMesh.value = selected;
	getEndpoints();
}
const getEndpoints = () => {
	loading.value = true;
	loader.value = true;
	pipyProxyService.getEndpoints(selectedMesh.value?.name)
		.then(res => {
			console.log("Endpoints:")
			console.log(res)
			loading.value = false;
			setTimeout(() => {
				loader.value = false;
			},2000)
			endpoints.value = res || [];
			endpoints.value.forEach((ep,ei)=>{
				ep.key = `${ei}`;
				ep.index = ei;
				ep.type = "ep";
				ep.label = ep?.name;
				ep.leaf = false;
				ep.loading = false;
			})
		})
		.catch(err => console.log('Request Failed', err)); 
}

const typing = ref('');
const clickSearch = () => {
}
const active = ref(0);

const expand = (node) => {
	if (!node.children) {
		node.loading = true;
		node.children = [];
		/*
		 * get services
		 */
		pipyProxyService.getServices({
			mesh:selectedMesh.value?.name,
			ep:node?.id
		})
			.then(res => {
				const _children = res;
				_children.forEach((service,sid)=>{
					service.key = node.key + '-s-' + sid,
					service.label = service.name;
					service.type = "service";
					node.children.push(service);
				});
				node.loading = false;
			})
			.catch(err => console.log('Request Failed', err)); 

		/*
		 * get ports
		 */
		pipyProxyService.getPorts({
			mesh:selectedMesh.value?.name,
			ep:node?.id
		})
			.then(res => {
				const _children = res;
				_children.forEach((port,pid)=>{
					port.key = node.key + '-p-' + pid,
					port.label = `${port.listen?.ip}:${port.listen?.port}`;
					port.type = "port";
					node.children.push(port);
				});
			})
			.catch(err => console.log('Request Failed', err)); 
	}
};


</script>

<template>
	<Card class="nopd ml-3 mr-3 mt-3">
		<template #content>
			<InputGroup class="search-bar" >
				<MeshSelector
					:full="true" 
					innerClass="transparent" 
					@load="load" 
					@select="select"/>
			</InputGroup>
		</template>
	</Card>
	<TabView class="pt-3 pl-3 pr-3" v-model:activeIndex="active">
		<TabPanel>
			<template #header>
				<div>
					<i class="pi pi-chart-scatter mr-2"/> Endpoints
					<i @click="getEndpoints" class="pi pi-refresh ml-2 refresh-icon" :class="{'spiner':loader}"/>
				</div>
			</template>
			<Loading v-if="loading"/>
			<div v-else class="text-center">
				<Tree 
					v-if="endpoints && endpoints.length >0" 
					:value="endpoints" 
					@node-expand="expand" 
					loadingMode="icon" 
					class="transparent">
					<template #default="slotProps">
							<b v-if="slotProps.node.type == 'ep'" v-tooltip="`ID:${slotProps.node.id}`">
								<span class="status-point run mr-3" :class="{'run':slotProps.node.status=='OK'}"/>
								EP: {{ slotProps.node.label || slotProps.node.id }} 
								<span v-if="!!slotProps.node.port" class="font-normal text-gray-500 ml-1">| {{slotProps.node.ip}}:{{slotProps.node.port}}</span>
								<span class="ml-2"><Tag class="relative" style="top:-2px">{{slotProps.node.isLocal?'Local':'Remote'}}</Tag></span>
								
								
							</b>
							<b v-else-if="slotProps.node.type == 'service'">
								<Avatar icon="pi pi-server" class="mr-2" />Service: {{ slotProps.node.label }}
								<span v-if="!!slotProps.node.port" class="font-normal text-gray-500 ml-1">| {{slotProps.node.host}}:{{slotProps.node.port}}</span>
								<span class="ml-2"><Tag class="relative" style="top:-2px">{{slotProps.node.protocol}}</Tag></span>
							</b>
							<b v-else-if="slotProps.node.type == 'port'">
								<Avatar icon="pi pi-bullseye" class="mr-2" />Port: {{ slotProps.node.label }}
								<span v-if="!!slotProps.node.target" class="font-normal text-gray-500 ml-1">| {{slotProps.node.target.service}}</span>
								<span class="ml-2"><Tag class="relative" style="top:-2px">{{slotProps.node.protocol}}</Tag></span>
							</b>
					</template>
				</Tree>
				<img v-else :src="freeSvg" class="w-5 h-5 mx-aut" style="margin: auto;"  />
			</div>
		</TabPanel>
	</TabView>
</template>

<style scoped lang="scss">
:deep(.p-dataview-content) {
  background-color: transparent !important;
}
.drak-input{
	border: none;
	min-height: 33px !important;
}
:deep(.p-tabview-nav),
:deep(.p-tabview-panels),
:deep(.p-tabview-nav-link){
	background: transparent !important;
}
</style>