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
const endpointMap = ref({});
const ports = ref([])
const selectedMesh = ref(null);

const meshes = computed(() => {
	return store.getters['account/meshes']
});

const load = (d) => {
	meshes.value = d;
}
onActivated(()=>{
	getPorts();
	getEndpoints();
})
const select = (selected) => {
	selectedMesh.value = selected;
	getPorts();
	getEndpoints();
}
const deletePort = (port) => {
	confirm.require({
	    message: `Are you sure to delete this port?`,
	    header: 'Tips',
	    icon: 'pi pi-exclamation-triangle',
	    accept: () => {
				pipyProxyService.deletePort({
					mesh:selectedMesh.value?.name,
					ep:selectedMesh.value?.agent?.id,
					proto: port.protocol,
					ip: port?.listen?.ip,
					port: port?.listen?.port
				})
					.then(res => {
						console.log(res);
						getPorts();
					})
					.catch(err => {
						console.log('Request Failed', err);
						getPorts();
					}); 
	    },
	    reject: () => {
	    }
	});
}

const getEndpoints = () => {
	pipyProxyService.getEndpoints(selectedMesh.value?.name)
		.then(res => {
			res.forEach((ep) => {
				endpointMap.value[ep.id] = ep;
			})
		})
		.catch(err => console.log('Request Failed', err)); 
}

const getPorts = () => {
	loading.value = true;
	loader.value = true;
	setTimeout(()=>{
		pipyProxyService.getPorts({
			mesh:selectedMesh.value?.name,
			ep:selectedMesh.value?.agent?.id
		})
			.then(res => {
				console.log("ports:")
				console.log(res)
				loading.value = false;
				setTimeout(() => {
					loader.value = false;
				},1400)
				ports.value = res || [];
			})
			.catch(err => console.log('Request Failed', err)); 
	},600);
}
const portsFilter = computed(() => {
	return ports.value.filter((port)=>{
		return (typing.value == '' || typing.value == port.target.service|| typing.value == port.listen.port );
	})
});

const typing = ref('');
const clickSearch = () => {
}
const active = ref(0);


</script>

<template>
	<Card class="nopd ml-3 mr-3 mt-3">
		<template #content>
			<InputGroup class="search-bar" >
				<MeshSelector
					:full="false" 
					innerClass="transparent" 
					@load="load" 
					@select="select"/>
				<Textarea @keyup="watchEnter" v-model="typing" :autoResize="true" class="drak-input bg-gray-900 text-white" placeholder="Type service | port" rows="1" cols="30" />
				<Button :disabled="!typing" icon="pi pi-search"  @click="clickSearch"/>
			</InputGroup>
		</template>
	</Card>
	
	<TabView class="pt-3 pl-3 pr-3" v-model:activeIndex="active">
		<TabPanel>
			<template #header>
				<div>
					<i class="pi pi-bullseye mr-2"/> Ports
					<i @click="getPorts" class="pi pi-refresh ml-2 refresh-icon" :class="{'spiner':loader}"/>
				</div>
			</template>
			<Loading v-if="loading"/>
			<div v-else class="text-center">
				<div class="grid text-left" v-if="portsFilter && portsFilter.length >0">
						<div class="col-12 md:col-6 lg:col-3" v-for="(port,hid) in portsFilter" :key="hid">
							 <div class="surface-card shadow-2 p-3 border-round">
									 <div class="flex justify-content-between mb-3">
											 <div>
													<span class="block text-500 font-medium mb-3">
														 {{port.listen.ip}} | {{port.protocol}}
													</span>
													
													<div class="text-900 font-medium text-xl"><i class="pi pi-bullseye text-gray-500"></i> {{port.listen.port}}</div>
											 </div>
											 <div class="flex">
												 <div v-tooltip="'Delete Port'"  @click="deletePort(port)" class="pointer flex align-items-center justify-content-center bg-gray-100 border-round mr-2" style="width: 2.5rem; height: 2.5rem">
														 <i class="pi pi-trash text-gray-500 text-xl"></i>
												 </div>
											 </div>
									 </div>
										<Fieldset legend="Target" :toggleable="true" >
											<div class="mb-2" v-if="port?.mesh">
												<Chip class="pl-0 pr-3 mr-2">
														<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
															<i class="pi pi-globe"/>
														</span>
														<span class="font-medium ml-2">
															Mesh: {{decodeURI(port.mesh)}}
														</span>
												</Chip>
											</div>
											<div class="mb-2">
												<Chip class="pl-0 pr-3 mr-2">
														<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
															<i class="pi pi-server"/>
														</span>
														<span class="font-medium ml-2">
															Service: {{port.target?.service}}
														</span>
												</Chip>
											</div>
											<div class="mb-2" v-if="port.target?.endpoint">
												<Chip class="pl-0 pr-3 mr-2">
														<span style="min-width: 28px;" class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
															<i class="pi pi-chart-scatter"/>
														</span>
														<span class="font-medium ml-2">
															EP: {{endpointMap[port.target?.endpoint]?.name||'Unnamed EP' }}
														</span>
												</Chip>
											</div>
										</Fieldset>
							 </div>
					 </div>
				</div>
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