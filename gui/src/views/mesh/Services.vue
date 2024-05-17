<script setup>
import { ref, onMounted,onActivated, computed,watch } from "vue";
import { useRouter } from 'vue-router'
import PipyProxyService from '@/service/PipyProxyService';
import ServiceCreate from './ServiceCreate.vue'
import MeshSelector from './common/MeshSelector.vue'
import PortMaping from './PortMaping.vue'
import { useConfirm } from "primevue/useconfirm";
import freeSvg from "@/assets/img/free.svg";
import { useStore } from 'vuex';
const store = useStore();

const confirm = useConfirm();
const router = useRouter();
const pipyProxyService = new PipyProxyService();
const services = ref([]);
const endpointMap = ref({});
const endpoints = ref([]);
const status = ref({});
const scopeType = ref('All');
const portMap = ref({});
const loading = ref(false);
const loader = ref(false);
const active = ref(0);
const meshes = computed(() => {
	return store.getters['account/meshes']
});
const selectedMesh = computed(() => {
	return store.getters["account/selectedMesh"]
});
onActivated(()=>{
	if(selectedMesh.value){
		getServices();
		getEndpoints();
		getPorts();
	}
})
const deleteService = () => {
	const service = selectedService.value?.service;
	if(!service){
		return;
	}
	const ep = endpointMap.value[service.ep?.id]?.name|| 'Unnamed EP';
	pipyProxyService.deleteService({
		name: service.name,
		proto: service.protocol,
		mesh:selectedMesh.value?.name,
		ep: service.ep?.id
	},() => {
		setTimeout(()=>{
			getServices();
		},1000)
		
		selectedService.value = null;
		visibleEditor.value = false;
	});
}

const getEndpoints = () => {
	pipyProxyService.getEndpoints(selectedMesh.value?.name)
		.then(res => {
			endpoints.value = res;
			res.forEach((ep) => {
				endpointMap.value[ep.id] = ep;
			})
		})
		.catch(err => console.log('Request Failed', err)); 
}

const getServices = () => {
	active.value = 0;
	loading.value = true;
	loader.value = true;
	if(!!selectedMesh.value){
		pipyProxyService.getServices({
			mesh:selectedMesh.value?.name
		})
			.then(res => {
				console.log("services:")
				console.log(res)
				loading.value = false;
				setTimeout(() => {
					loader.value = false;
				},2000)
				services.value = res || [];
			})
			.catch(err => console.log('Request Failed', err)); 
	}
}

const getPorts = () => {
	portMap.value = {}
	pipyProxyService.getPorts({
		mesh:selectedMesh.value?.name,
		ep:selectedMesh.value?.agent?.id
	})
		.then(res => {
			res.forEach((port)=>{
				portMap.value[`${port.target?.service}-${port.target?.endpoint||''}`] = `${port.listen.ip}:${port.listen.port}:${port.protocol}`;
			})
		})
		.catch(err => console.log('Request Failed', err)); 
}

watch(()=>selectedMesh,()=>{
	if(selectedMesh.value){
		getServices();
		getEndpoints();
		getPorts();
	}
},{
	deep:true,
	immediate:true
})
const portInfo = computed(() => {
	return (svc,ep) => {
		const postAry = [];
		if(portMap.value[`${svc}-${ep}`]){
			postAry.push(portMap.value[`${svc}-${ep}`])
		}  
		if(portMap.value[`${svc}-`]){
			postAry.push(portMap.value[`${svc}-`])
		}  
		return postAry.join("\n");
	}
});


const portInfobyLb = computed(() => {
	return (svc) => {
		return portMap.value[`${svc}-`];
	}
});

const servicesFilter = computed(() => {
	return services.value.filter((svc)=>{
		return (typing.value == '' || svc.name.indexOf(typing.value)>=0 || typing.value == svc.host) 
		&& (scopeType.value == 'All' || (scopeType.value == 'Remote' && !svc.isLocal) || (scopeType.value == 'Local' && !!svc.isLocal))
	})
});


const servicesLb = computed(() => {
	const lbMap = {};
	servicesFilter.value.forEach((svc)=>{
		if(!lbMap[svc.name]){
			lbMap[svc.name] = [];
		}
		svc.endpoints.forEach((ep) => {
			lbMap[svc.name].push({
				ep: ep,
				...svc
			});
		})
	});
	return Object.values(lbMap);
});

const typing = ref('');
const save = () => {
	active.value = 0;
	getServices();
	selectedService.value = null;
	visibleEditor.value = false;
}
const visiblePort = ref(false)
const selectedService = ref(null);
const targetEndpoints = ref(null);
const mappingPort = ({service, ep, lb}) => {
	targetEndpoints.value = [];
	if(!!lb){
		lb.forEach(svc=>{
			targetEndpoints.value.push(svc.ep);
		})
	}
	visiblePort.value = true;
	selectedService.value = {service, ep};
}
const savePort = () => {
	visiblePort.value = false;
	getPorts();
}

const actionMenu = ref();
const actions = ref([
    {
        label: 'Actions',
        items: [
            {
                label: 'Edit',
                icon: 'pi pi-pencil',
								command: () => {
									openEditor()
								}
            },
            {
                label: 'Delete',
                icon: 'pi pi-trash',
								command: () => {
									deleteService()
								}
            }
        ]
    }
]);
const showAtionMenu = (event, svc) => {
	selectedService.value = svc;
	actionMenu.value[0].toggle(event);
};
const visibleEditor = ref(false);
const openEditor = () => {
	visibleEditor.value = true;
}
</script>

<template>
	<Card class="nopd ml-3 mr-3 mt-3">
		<template #content>
			<InputGroup class="search-bar" v-show="active!=1">
				<Button :disabled="!typing" icon="pi pi-search"  :label="selectedMesh?.name"/>
				<Textarea @keyup="watchEnter" v-model="typing" :autoResize="true" class="drak-input bg-gray-900 text-white flex-1" placeholder="Type service | host" rows="1" cols="30" />
			</InputGroup>
		</template>
	</Card>
	
	<TabView class="pt-3 pl-3 pr-3" v-model:activeIndex="active">
		<TabPanel>
			<template #header>
				<div>
					<i class="pi pi-sitemap mr-2" />Services
					<i @click="getServices" class="pi pi-refresh ml-2 refresh-icon" :class="{'spiner':loader}"/>
				</div>
			</template>
			<Loading v-if="loading"/>
			<div v-else class="text-center">
				<div class="grid text-left" v-if="servicesLb && servicesLb.length >0">
						<div class="col-12 md:col-6 lg:col-4" v-for="(lb,hid) in servicesLb" :key="hid">
							 <div class="surface-card shadow-2 p-3 border-round">
									 <div class="flex justify-content-between">
											 <div>
													<span class="block text-500 font-medium mb-3"><i class="pi pi-server text-gray-500"></i> {{lb[0].name}}</span>
											 </div>
											 <div class="flex">
												 <div 
													 @click="mappingPort({service: lb[0],lb})"
													 v-if="!!portInfobyLb(lb[0].name)" 
													 v-tooltip="'Port:'+portInfobyLb(lb[0].name)" 
													 class="pointer flex align-items-center justify-content-center bg-green-100 border-round mr-2" 
													 style="width: 2.5rem; height: 2.5rem">
														 <i class="pi pi-circle text-green-500 text-xl"></i>
												 </div>
												 <div v-else v-tooltip="'Connect'"  @click="mappingPort({service: lb[0],lb})" class="pointer flex align-items-center justify-content-center bg-primary-100 border-round mr-2" style="width: 2.5rem; height: 2.5rem">
														 <i class="pi pi-circle text-primary-500 text-xl"></i>
												 </div>
											 </div>
	<!-- 	       								<div v-tooltip="'Revoke'" @click="changeStatus(service, 3)" v-else-if="service.scope == 'Private'" class="pointer flex align-items-center justify-content-center bg-purple-100 border-round" style="width: 2.5rem; height: 2.5rem">
													<i class="pi pi-spin pi-spinner text-purple-500 text-xl"></i>
											</div> -->
										<!-- 	<div v-badge.danger="'3'" v-tooltip="'Subscriptions'" @click="clients" class="mr-3 pointer flex align-items-center justify-content-center bg-gray-100 border-round" style="width: 2.5rem; height: 2.5rem">
												<i class="pi pi-user text-gray-500 text-xl"></i>
											</div>
											<div v-tooltip="'Manage'" @click="newHub" class="pointer flex align-items-center justify-content-center bg-gray-100 border-round" style="width: 2.5rem; height: 2.5rem">
												<i class="pi pi-pencil text-gray-500 text-xl"></i>
											</div> -->
									 </div>
										<Fieldset :legend="lb.length+ (lb.length>1?' Endpoints':' Endpoint')" :toggleable="true">
											<div class="surface-card border-round">
												<div v-for="(service, sid) in lb" :key="sid" class="flex mb-3 w-full">
													<div class="flex-item">
														<div class="text-500 flex w-full">
															<span class="status-point run mr-4 relative vm" style="top: 12px;" ></span>
															<div class="flex flex-item align-items-center" :class="{'flex-column': !!service.port || !!service.host}">
																<div class="text-left w-full " v-tooltip="endpointMap[service.ep?.id]?.name" ><b class="text-ellipsis" style="width: 90%;">{{endpointMap[service.ep?.id]?.name|| 'Unnamed EP'}}</b></div>
																<div class="text-left w-full" v-if="!!service.port || !!service.host"><Tag  severity="contrast" value="Contrast" v-if="service.ep?.isLocal">Local</Tag> <Tag severity="secondary" value="Secondary">{{service.protocol}}</Tag> <span class="relative" style="top: 2px;">{{service.host}}{{!!service.port?(`:${service.port}`):''}}</span> </div>
															</div>
														</div>
													</div>
													<div class="flex text-right" style="width: 5rem;">
														<div 
															@click="mappingPort({service: service,ep:{id:service.ep?.id, name: (endpointMap[service.ep?.id]?.name|| 'Unnamed EP')}})"
															v-if="!!portInfo(service.name,selectedMesh?.agent?.id)" 
															v-tooltip="'Port:'+portInfo(service.name,selectedMesh?.agent?.id)" 
															class="pointer flex align-items-center justify-content-center bg-green-100 border-round mr-2" 
															style="width: 2rem; height: 2rem">
																<i class="pi pi-circle text-green-500 text-xl"></i>
														</div>
														<div v-else v-tooltip="'Connect by EP'" @click="mappingPort({service: service,ep:{id:service.ep?.id, name: (endpointMap[service.ep?.id]?.name|| 'Unnamed EP')}})" class="pointer flex align-items-center justify-content-center bg-primary-100 border-round mr-2" style="width: 2rem; height: 2rem">
															<i class="pi pi-circle text-primary-500 text-xl"></i>
														</div>
														<div @click="showAtionMenu($event, {service: service,ep:{id:service.ep?.id, name: (endpointMap[service.ep?.id]?.name|| 'Unnamed EP')}})" aria-haspopup="true" aria-controls="actionMenu" class="pointer flex align-items-center justify-content-center bg-gray-100 border-round" style="width: 2rem; height: 2rem">
															<i class="pi pi-ellipsis-v text-gray-500 text-xl"></i>
														</div>
														<Menu ref="actionMenu" :model="actions" :popup="true" />
													<!-- 	
														<Button size="small" type="button" severity="secondary" icon="pi pi-ellipsis-v" @click="showAtionMenu($event, mesh)" aria-haspopup="true" aria-controls="actionMenu" />
														 -->
												  </div>
												</div>
											</div>
										</Fieldset>
							 </div>
					 </div>
				</div>
				<img v-else :src="freeSvg" class="w-5 h-5 mx-aut" style="margin: auto;"  />
			</div>
		</TabPanel>
		<TabPanel >
			<template #header>
				<i class="pi pi-plus mr-2" /> Create
			</template>
			<ServiceCreate v-if="!!meshes && meshes.length>0" @save="save"/>
			<div v-else>
				Join a mesh first.
			</div>
		</TabPanel>
	</TabView>
	<Dialog 
		v-if="selectedMesh" 
		:showHeader="false" 
		class="nopd transparent"
		v-model:visible="visiblePort" 
		modal 
		:style="{ width: '100%', maxWidth: '900px', padding: 0 }"
		>
		<PortMaping 
			@save="savePort" 
			:mesh="selectedMesh?.name" 
			:endpoint="selectedMesh?.agent?.id" 
			:endpoints="endpoints"
			:targetEndpoints="targetEndpoints"
			:proto="selectedService?.service?.protocol"
			:service="selectedService?.service?.name" 
			:servicePort="selectedService?.service?.port"
			:targetEndpoint="selectedService?.ep"/>
	</Dialog>
	<Dialog :closable="false" class="noheader" v-model:visible="visibleEditor" modal header="Edit Service" :style="{ width: '90%' }">
		<ServiceCreate 
			title="Edit Service" 
			v-if="selectedService" 
			:mesh="selectedMesh?.name" 
			:pid="selectedService?.service?.name" 
			:ep="selectedService?.ep?.id" 
			:proto="selectedService?.service?.protocol"
			@save="save" 
			@cancel="() => visibleEditor=false"/>
	</Dialog>
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