<script setup>
import { ref, onMounted,onActivated, computed,watch } from "vue";
import { useRouter } from 'vue-router'
import PipyProxyService from '@/service/PipyProxyService';
import ServiceCreate from './ServiceCreate.vue'
import MeshSelector from './common/MeshSelector.vue'
import PortMaping from './PortMaping.vue'
import { useConfirm } from "primevue/useconfirm";
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
const visibleEditor = ref(false);
const meshes = computed(() => {
	return store.getters['account/meshes']
});
const selectedMesh = computed(() => {
	return store.getters["account/selectedMesh"]
});

const isChat = computed(() => store.getters['account/isChat']);
onActivated(()=>{
	if(selectedMesh.value){
		getServices();
		getEndpoints();
		getPorts();
	}
})
const props = defineProps(['ep','embed']);
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
const error = ref();
const getServices = () => {
	visibleEditor.value = false;
	loading.value = true;
	loader.value = true;
	if(!!selectedMesh.value){
		pipyProxyService.getServices({
			mesh:selectedMesh.value?.name,
			ep:props.embed?props.ep:null
		})
			.then(res => {
				console.log("services:")
				console.log(res)
				loading.value = false;
				setTimeout(() => {
					loader.value = false;
				},2000)
				error.value = null;
				services.value = res || [];
			})
			.catch(err => {
				loading.value = false;
				loader.value = false;
				error.value = err;
				console.log('Request Failed', err)
			}); 
	}
}

const getPorts = () => {
	portMap.value = {}
	pipyProxyService.getPorts({
		mesh:selectedMesh.value?.name,
		ep:props.embed?props.ep:selectedMesh.value?.agent?.id
	})
		.then(res => {
			(res||[]).forEach((port)=>{
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
		if(props.embed){
			svc.endpoints = [];
			svc.endpoints.push({
				id: props.ep
			})
		}
		svc.endpoints.forEach((_ep) => {
			lbMap[svc.name].push({
				ep: _ep,
				...svc
			});
		})
	});
	return Object.values(lbMap);
});

const typing = ref('');
const save = () => {
	visibleEditor.value = false;
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
	actionMenu.value.toggle(event);
};
const openEditor = () => {
	visibleEditor.value = true;
}
const layout = ref('grid');
const expandedRows = ref({});
const back = () => {
	router.go(-1)
}

const toggleLeft = () => {
	store.commit('account/setMobileLeftbar', !store.getters['account/mobileLeftbar']);
}
const windowWidth = ref(window.innerWidth);
const isMobile = computed(() => windowWidth.value<=768);

const emptyMsg = computed(()=>{
	if(!!selectedMesh.value?.name){
		return 'No service.'
	} else {
		return `First, join a ${isChat.value?'Channel':'Mesh'}.`
	}
});
</script>

<template>
	<div class="flex flex-row">
		<div :class="{'w-24rem':(!!visibleEditor),'w-full':(!visibleEditor),'mobile-hidden':(!!visibleEditor)}">
			<AppHeader v-if="!props.embed" :main="!isChat" >
					<template #center>
						<b>Services</b>
					</template>
			
					<template #end> 
						<Button icon="pi pi-refresh" text @click="getServices"  :loading="loader"/>
						<DataViewLayoutOptions v-if="!isMobile" v-model="layout" style="z-index: 2;"/>
						<Button icon="pi pi-plus"  :label="visibleEditor?null:'Create'" @click="() => visibleEditor = true"/>
					</template>
			</AppHeader>
			<Card class="nopd" v-if="!error">
				<template #content>
					<InputGroup class="search-bar" >
						<Button :disabled="!typing" icon="pi pi-search"  :label="props.embed?null:selectedMesh?.name"/>
						<Textarea @keyup="watchEnter" v-model="typing" :autoResize="true" class="drak-input bg-gray-900 text-white flex-1" placeholder="Type service | host" rows="1" cols="30" />
						<Button v-if="props.embed" icon="pi pi-plus" @click="() => visibleEditor = true"/>
					</InputGroup>
				</template>
			</Card>
			<Loading v-if="loading"/>
			<div v-else-if="servicesLb && servicesLb.length >0" class="text-center">
				<DataTable v-if="layout == 'list'" class="nopd-header w-full" v-model:expandedRows="expandedRows" :value="servicesLb" dataKey="id" tableStyle="min-width: 50rem">
						<Column expander style="width: 5rem" />
						<Column header="Service">
							<template #body="slotProps">
								<span class="block text-tip font-medium"><i class="pi pi-server text-tip"></i> {{slotProps.data[0].name}}</span>
							</template>
						</Column>
						<Column header="Endpoints">
							<template #body="slotProps">
								<Badge :value="slotProps.data.length"/>
							</template>
						</Column>
						<Column header="Action"  style="width: 110px;">
							<template #body="slotProps">
			
							 <div 
								 @click="mappingPort({service: slotProps.data[0],lb:slotProps.data})"
								 v-if="!!portInfobyLb(slotProps.data[0].name)" 
								 v-tooltip="'Port:'+portInfobyLb(slotProps.data[0].name)" 
								 class="pointer flex align-items-center justify-content-center bg-green-sec border-round mr-2" 
								 style="width: 2rem; height: 2rem">
									 <i class="pi pi-circle text-xl"></i>
							 </div>
							 <div v-else v-tooltip="'Connect'"  @click="mappingPort({service: slotProps.data[0],lb:slotProps.data[0]})" class="pointer flex align-items-center justify-content-center bg-primary-sec border-round mr-2" style="width: 2.5rem; height: 2.5rem">
									 <i class="pi pi-circle text-xl"></i>
							 </div>
							</template>
						</Column>
						<template #expansion="parentSlotProps">
								<div class="pl-7" v-if="!!parentSlotProps.data.length > 0">
										<DataTable :value="parentSlotProps.data || []" >
											<Column header="Endpoint">
												<template #body="slotProps">
													{{endpointMap[slotProps.data.ep?.id]?.name|| 'Unnamed EP'}}
												</template>
											</Column>
											<Column header="Info">
												<template #body="slotProps">
													<div v-if="!!slotProps.data.port || !!slotProps.data.host">
														<Tag class="mr-2" severity="contrast" value="Contrast" v-if="slotProps.data.ep?.isLocal">Local</Tag> 
														<Tag class="mr-2" severity="secondary" value="Secondary">{{slotProps.data.protocol}}</Tag> 
														<span class="relative" style="top: 2px;">{{slotProps.data.host}}{{!!slotProps.data.port?(`:${slotProps.data.port}`):''}}</span> 
													</div>
												</template>
											</Column>
											
											<Column header="Action" style="width: 100px;">
												<template #body="slotProps">
													<div class="flex">
														<div 
															@click="mappingPort({service: slotProps.data,ep:{id:slotProps.data.ep?.id, name: (endpointMap[slotProps.data.ep?.id]?.name|| 'Unnamed EP')}})"
															v-if="!!portInfo(slotProps.data.name,selectedMesh?.agent?.id)" 
															v-tooltip="'Port:'+portInfo(slotProps.data.name,selectedMesh?.agent?.id)" 
															class="pointer flex align-items-center justify-content-center bg-green-sec border-round mr-2" 
															style="width: 2rem; height: 2rem">
																<i class="pi pi-circle text-xl"></i>
														</div>
														<div v-else v-tooltip="'Connect by EP'" @click="mappingPort({service: slotProps.data,ep:{id:slotProps.data.ep?.id, name: (endpointMap[slotProps.data.ep?.id]?.name|| 'Unnamed EP')}})" class="pointer flex align-items-center justify-content-center bg-primary-sec border-round mr-2" style="width: 2rem; height: 2rem">
															<i class="pi pi-circle text-xl"></i>
														</div>
														<div @click="showAtionMenu($event, {service: slotProps.data,ep:{id:slotProps.data.ep?.id, name: (endpointMap[slotProps.data.ep?.id]?.name|| 'Unnamed EP')}})" aria-haspopup="true" aria-controls="actionMenu" class="pointer flex align-items-center justify-content-center p-button-secondary border-round" style="width: 2rem; height: 2rem">
															<i class="pi pi-ellipsis-v text-tip text-xl"></i>
														</div>
													</div>
												</template>
											</Column>
										</DataTable>
								</div>
						</template>
				</DataTable>
				<div v-else class="grid text-left mt-1 px-3" v-if="servicesLb && servicesLb.length >0">
						<div  :class="(!visibleEditor)?'col-12 md:col-6 lg:col-4':'col-12'" v-for="(lb,hid) in servicesLb" :key="hid">
							 <div class="surface-card shadow-2 p-3 border-round">
									 <div class="flex justify-content-between">
											 <div>
													<span class="block text-tip font-medium mb-3"><i class="pi pi-server text-tip relative" style="top: 2px;"></i> {{lb[0].name}}</span>
													<div class="text-left w-full" v-if="!!lb[0].port || !!lb[0].host"><Tag  severity="contrast" value="Contrast" v-if="lb[0].ep?.isLocal">Local</Tag> <Tag severity="secondary" value="Secondary">{{lb[0].protocol}}</Tag> <span class="relative" style="top: 2px;">{{lb[0].host}}{{!!lb[0].port?(`:${lb[0].port}`):''}}</span> </div>
											 </div>
											 <div class="flex">
												 <div 
													 @click="mappingPort({service: lb[0],lb})"
													 v-if="!!portInfobyLb(lb[0].name)" 
													 v-tooltip="'Port:'+portInfobyLb(lb[0].name)" 
													 class="pointer flex align-items-center justify-content-center bg-green-sec border-round mr-2" 
													 :style="props.embed?'width: 2rem; height: 2rem':'width: 2.5rem; height: 2.5rem'">
														 <i class="pi pi-circle text-xl"></i>
												 </div>
												 <div v-else v-tooltip="'Connect'"  @click="mappingPort({service: lb[0],lb})" class="pointer flex align-items-center justify-content-center bg-primary-sec border-round mr-2" :style="props.embed?'width: 2rem; height: 2rem':'width: 2.5rem; height: 2.5rem'">
														 <i class="pi pi-circle text-xl"></i>
												 </div>
												 
												 <div v-if="props.embed" @click="showAtionMenu($event, {service: lb[0],ep:{id:props.ep, name: (endpointMap[lb[0].ep?.id]?.name|| 'Unnamed EP')}})" aria-haspopup="true" aria-controls="actionMenu" class="pointer flex align-items-center justify-content-center p-button-secondary border-round" style="width: 2rem; height: 2rem">
													<i class="pi pi-ellipsis-v text-tip text-xl"></i>
												 </div>
											 </div>
									 </div>
										<Fieldset v-if="!props.embed" :legend="lb.length+ (lb.length>1?' Endpoints':' Endpoint')" :toggleable="true">
											<div >
												<div v-for="(service, sid) in lb" :key="sid" class="flex mb-3 w-full">
													<div class="flex-item">
														<div class="text-tip flex w-full">
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
															class="pointer flex align-items-center justify-content-center bg-green-sec border-round mr-2" 
															style="width: 2rem; height: 2rem">
																<i class="pi pi-circle text-xl"></i>
														</div>
														<div v-else v-tooltip="'Connect by EP'" @click="mappingPort({service: service,ep:{id:service.ep?.id, name: (endpointMap[service.ep?.id]?.name|| 'Unnamed EP')}})" class="pointer flex align-items-center justify-content-center bg-primary-sec border-round mr-2" style="width: 2rem; height: 2rem">
															<i class="pi pi-circle text-xl"></i>
														</div>
														<div @click="showAtionMenu($event, {service: service,ep:{id:service.ep?.id, name: (endpointMap[service.ep?.id]?.name|| 'Unnamed EP')}})" aria-haspopup="true" aria-controls="actionMenu" class="pointer flex align-items-center justify-content-center p-button-secondary border-round" style="width: 2rem; height: 2rem">
															<i class="pi pi-ellipsis-v text-tip text-xl"></i>
														</div>
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
				<Menu ref="actionMenu" :model="actions" :popup="true" />
			</div>
			<Empty v-else :title="emptyMsg" :error="error"/>
		</div>
		<div class="flex-item" v-if="!!visibleEditor">
			<div class="shadow mobile-fixed">
				<ServiceCreate
					:embed="props.embed"
					:title="!!selectedService?(isChat?'Edit Service':'Edit Service'):null" 
					:mesh="selectedMesh?.name" 
					:pid="selectedService?.service?.name" 
					:ep="selectedService?.ep?.id" 
					:proto="selectedService?.service?.protocol"
					@save="save" 
					@back="() => {selectedService=null;visibleEditor=false;}"/>
			</div>
		</div>
	</div>
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
:deep(.p-tabview-panels){
	padding: 0;
}
</style>