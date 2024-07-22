<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { merge } from '@/service/common/request';
import ZtmService from '@/service/ZtmService';
import TunnelService from '../service/TunnelService';
import { useRoute } from 'vue-router'
import { useToast } from "primevue/usetoast";
import { isAdmin } from "@/service/common/authority-utils";
import { useStore } from 'vuex';
import _ from "lodash"
const props = defineProps(['d','endpointMap']);
const emits = defineEmits(['save','back']);
const store = useStore();
const selected = ref(props.mesh);
const endpoints = ref([]);
const route = useRoute();
const toast = useToast();
const tunnelService = new TunnelService();
const ztmService = new ZtmService();
const info = computed(() => {
	return store.getters['app/info']
});
const loading = ref(false);
const scope = ref('public');
const newTunnel = {
	name: "",
	proto: "tcp",
}
const tunnel = ref(_.cloneDeep(newTunnel));
const newOutbound = {
	name: null,
	proto: null,
	ep: info.value.endpoint?.id,
	targets: [],
	entrances: [],
}
const outbound = ref(_.cloneDeep(newOutbound))
const outbounds = ref([])

const newInbound = {
	name: null,
	proto: null,
	ep: info.value.endpoint?.id,
	listens: [],
	exits: [],
}
const inbound = ref(_.cloneDeep(newInbound))
const inbounds = ref([])
const getEndpoints = () => {
	tunnelService.getEndpoints()
		.then(res => {
			console.log("Endpoints:")
			console.log(res)
			endpoints.value = res || [];
		})
		.catch(err => console.log('Request Failed', err)); 
}
const enabled = computed(() => {
	return !!tunnel.value.name
	&& ( 
		(outbounds.value.length>0) 
		|| (inbounds.value.length>0)  
	);
});
const addInEnabled = computed(() => {
	return inbound.value.listens.length>0 && inbound.value.ep;
});
const addOutEnabled = computed(() => {
	return outbound.value.targets.length>0 && outbound.value.ep;
});
const error = ref();
const back = () => {
	emits('back')
}
const inboundEditor = ref(false);
const outboundEditor = ref(false);
watch(()=> selected,()=>{
	getEndpoints();
},{
	immediate: true,
	deep:true,
})
const createTunnel = () => {
	const reqs = [];
	inbounds.value.forEach((_inbound)=>{
		if(_inbound.listens.length>0 && !!_inbound.listens[0] && _inbound.ep){
			reqs.push(tunnelService.createInbound({
				..._inbound,
				proto: tunnel.value.proto, 
				name: tunnel.value.name,
				ep:_inbound.ep?.id
			}))
		}
	})
	
	outbounds.value.forEach((_outbound)=>{
		if(_outbound.targets.length>0 && !!_outbound.targets[0] && _outbound.ep){
			reqs.push(tunnelService.createOutbound({
				..._outbound,
				proto: tunnel.value.proto, 
				name: tunnel.value.name,
				ep:_outbound.ep?.id
			}))
		}
	})
	return merge(reqs).then((allRes) => {
		outboundEditor.value = false;
		inboundEditor.value = false;
		loading.value = false;
		toast.add({ severity: 'success', summary:'Tips', detail: 'Save successfully.', life: 3000 });
		setTimeout(()=>{
			emits("save",tunnel.value);
		},1000);
	})
}
const commitIn = () => {
	if(!props.d){
		inbounds.value.push({
			...inbound.value,
			proto: tunnel.value.proto, 
			name: tunnel.value.name,
			ep:endpoints.value.find((_ep)=>_ep?.id == inbound.value.ep)
		});
		inboundEditor.value = false;
		inbound.value = _.cloneDeep(newInbound);
		return;
	}
	if(inbound.value.listens.length>0 && !!inbound.value.listens[0] && inbound.value.ep){
		
		loading.value = true;
		tunnelService.createInbound({
			...inbound.value,
			proto: tunnel.value.proto, 
			name: tunnel.value.name
		})
			.then(res => {
				inboundEditor.value = false;
				loading.value = false;
				inbound.value = _.cloneDeep(newInbound);
				toast.add({ severity: 'success', summary:'Tips', detail: 'Save successfully.', life: 3000 });
				setTimeout(()=>{
					emits("save",tunnel.value);
				},1000);
			})
			.catch(err => {
				loading.value = false;
				console.log('Request Failed', err)
			}); 
	}
}
const commitOut = () => {
	
	if(!props.d){
		outbounds.value.push({
			...outbound.value,
			proto: tunnel.value.proto, 
			name: tunnel.value.name,
			ep:endpoints.value.find((_ep)=>_ep?.id == inbound.value.ep)
		});
		outboundEditor.value = false;
		outbound.value = _.cloneDeep(newOutbound);
		return;
	}
	if(outbound.value.targets.length>0 && !!outbound.value.targets[0] && outbound.value.ep){
		
		loading.value = true;
		tunnelService.createOutbound({
			...outbound.value,
			proto: tunnel.value.proto, 
			name: tunnel.value.name
		})
			.then(res => {
				loading.value = false;
				outboundEditor.value = false;
				outbound.value = _.cloneDeep(newOutbound);
				toast.add({ severity: 'success', summary:'Tips', detail: 'Save successfully.', life: 3000 });
				setTimeout(()=>{
					emits("save",tunnel.value);
				},1000);
			})
			.catch(err => {
				loading.value = false;
				console.log('Request Failed', err)
			}); 
	}
}

const loaddata = () => {
	if(!props.d){
		tunnel.value = _.cloneDeep(newTunnel);
		inbound.value = _.cloneDeep(newInbound);
		outbound.value = _.cloneDeep(newOutbound);
	} else {
		tunnel.value = props.d;
		inbounds.value = props.d.inbounds;
		outbounds.value = props.d.outbounds;
	}
}
const inboundEdit = (t,index) => {
	inboundEditor.value = true;
	inbound.value = _.cloneDeep(t);
	inbound.value.ep = t.ep?.id;
}
const outboundEdit = (t,index) => {
	outboundEditor.value = true;
	outbound.value = _.cloneDeep(t);
	outbound.value.ep = t.ep?.id;
}
const inboundRemove = (t,index) => {
	if(!props.d){
		inbounds.value.splice(index,1)
	} else {
		tunnelService.deleteInbound({
			ep:t.ep?.id, proto:tunnel.value.proto, name:tunnel.value.name
		},()=>{
			emits("save",tunnel.value);
		})
	}
}
const outboundRemove = (t,index) => {
	if(!props.d){
		outbounds.value.splice(index,1)
	} else {
		tunnelService.deleteOutbound({
			ep:t.ep?.id, proto:tunnel.value.proto, name:tunnel.value.name
		},()=>{
			emits("save",tunnel.value);
		})
	}
}
onMounted(() => {
	loaddata()
});
watch(()=>props.d,()=>{
	loaddata();
},{
	deep:true
})
</script>

<template>

	<div class="surface-ground h-full" :style="{'minHeight':`calc(100vh - ${props.embed?'100px':'20px'})`}">
		<AppHeader :back="back">
				<template #center>
					 <Button icon="pi pi-arrow-right-arrow-left" text /> <b>{{props.d?`${props.d?.proto}/${props.d?.name}`:'New Tunnel'}}</b>
				</template>
		
				<template #end> 
					<Button v-if="!props.d" :loading="loading" :disabled="!enabled" label="Create" aria-label="Submit" size="small" @click="createTunnel"/>
				</template>
		</AppHeader>
		<div class="md:m-3 h-full relative">
		<ScrollPanel class="w-full absolute" style="top:0px;bottom: 0;">
			<Empty v-if="error" :error="error"/>
			<BlockViewer v-else containerClass="surface-section px-1 md:px-1 md:pb-7 lg:px-1" >
				<Loading v-if="loading" />
				<div v-else class="surface-ground surface-section h-full p-4" >
						<div class="mb-4" v-if="!props.d">
							<h6>
								<Tag>Metadata</Tag>
							</h6>
							<div class="grid" >
								<div class="col-12 md:col-6">
									<FormItem label="Tunnel" :border="false">
										<Chip class="pl-0 pr-3 mr-2">
												<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<i class="pi pi-bookmark"/>
												</span>
												<span class="ml-2 font-medium">
													<InputText :disabled="!!props.d" placeholder="Name your tunnel" class="add-tag-input xxl" :unstyled="true" v-model="tunnel.name" type="text" />
												</span>
										</Chip>
									</FormItem>
								</div>
								<div class="col-12 md:col-6">
									<FormItem label="Protocol" :border="false">
										<Chip class="pl-0 pr-3">
												<span class="border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<RadioButton  :disabled="!!props.d" v-model="tunnel.proto" inputId="scopeType2" name="scopeType" value="tcp" />
												</span>
												<span class="ml-2 font-medium">TCP</span>
										</Chip>
										<Chip class="ml-2 pl-0 pr-3">
												<span class="border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<RadioButton  :disabled="!!props.d" v-model="tunnel.proto" inputId="scopeType3" name="scopeType" value="udp" />
												</span>
												<span class="ml-2 font-medium">UDP</span>
										</Chip>
									</FormItem>
								</div>
							</div>
						</div>
						<div class="grid " >
							<div class="col-12 md:col-6">
								<h6 class="flex">
									<div>
										<Tag >Inbounds
											<Badge v-if="!!props.d" :value="inbounds.length" />
										</Tag> 
									</div>
									<div class="flex-item text-right">
										<Button 
											v-if="!loading && !inboundEditor" 
											@click="() => inboundEditor = true" 
											v-tooltip.left="'Add Inbound'" 
											size="small" 
											icon="pi pi-plus" ></Button>
										<div v-else-if="!loading" >
											<Button class="mr-2" @click="() => inboundEditor = false" size="small" icon="pi pi-angle-left" outlined ></Button>
											<Button :disabled="!addInEnabled" @click="commitIn()" v-tooltip="'Save Inbound'"  size="small" icon="pi pi-check" ></Button>
										</div>
									</div>
								</h6>
						
								<ul v-if="inboundEditor" class="list-none p-0 m-0">
									<FormItem label="Endpoint">
										<Chip class="pl-0 pr-3 mr-2">
												<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<i class="pi pi-chart-scatter"/>
												</span>
												<span class="font-medium">
													<Select
													 :disabled="!!props.pid"
														v-model="inbound.ep" 
														:options="endpoints" 
														optionLabel="name" 
														optionValue="id"
														placeholder="Endpoint" 
														class="flex"></Select>
												</span>
										</Chip>
									</FormItem>
									<FormItem label="Listens">
										<ChipList icon="pi-desktop" placeholder="IP:Port" v-model:list="inbound.listens" />
									</FormItem>
									<FormItem label="Entrances"  :border="false">
											<Chip class="pl-0 pr-3 mr-2">
													<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
														<i class="pi pi-chart-scatter"/>
													</span>
													<span class="font-medium">
														<MultiSelect
															v-model="inbound.exits" 
															:options="endpoints" 
															optionLabel="name" 
															optionValue="id"
															:filter="endpoints.length>=8"
															placeholder="Endpoints" 
															class="flex" :maxSelectedLabels="3"></MultiSelect>
												</span>
										</Chip>
									</FormItem>
								</ul>
								<DataView v-else :value="inbounds">
										<template #empty>
											No inbounds.
										</template>
									<template #list="slotProps">
										<div class="surface-border py-3" :class="{'border-top-1':index>0}" v-for="(item, index) in slotProps.items" :key="index">
												<div class="flex py-2 gap-4" :class="{ 'border-t border-surface-200 dark:border-surface-700': index !== 0 }">
														<div class="flex-item flex flex-col justify-between items-start gap-2">
															<div>
																<div class="text-lg font-medium mt-2">
																	<Tag v-if="info.endpoint?.id == item.ep?.id" class="mr-2" severity="contrast" >Local</Tag> 
																	{{ item.ep?.name }}
																</div>
															</div>
														</div>
														<div class="flex flex-col md:items-end gap-4">
															<div>
																<div  class="flex flex-col gap-4 mb-2">
																	<span class="font-semibold w-6rem ">Listens:</span>
																	<span class="text-xl font-semibold"><Tag class="block" :class="{'mt-1':idx==1}" v-for="(listen,idx) in item.listens" :value="listen" severity="secondary" /></span>
																</div>
																<div class="flex flex-col gap-4">
																	<span class="font-semibold w-6rem " v-if="item.exits && item.exits.length>0">Exits:</span>
																	<span class="text-xl font-semibold" v-if="item.exits && item.exits.length>0"><Tag class="block" :class="{'mt-1':idx==1}" v-for="(exit,idx) in item.exits" :value="props.endpointMap[exit]?.name || props.endpointMap[exit]?.username || props.endpointMap[exit]?.id" severity="secondary" /></span>
																</div>
															</div>	
															<div class="flex flex-row-reverse md:flex-row gap-2 pl-4">
																	<Button @click="inboundRemove(item,index)" size="small" icon="pi pi-trash" outlined></Button>
																	<Button v-if="!!props.d" @click="inboundEdit(item,index)" size="small" icon="pi pi-pencil" class="flex-auto md:flex-initial whitespace-nowrap"></Button>
															</div>
														</div>
												</div>
										</div>
									</template>
								</DataView>
							</div>
							<div class="col-12 md:col-6">
								<h6 class="flex">
									<div>
										<Tag >Outbounds
											<Badge v-if="!!props.d" :value="outbounds.length" />
										</Tag> 
									</div>
									<div class="flex-item text-right">
										<Button 
											v-if="!loading && !outboundEditor" 
											@click="() => outboundEditor = true" 
											v-tooltip.left="'Add Outbound'" 
											size="small" 
											icon="pi pi-plus" ></Button>
										<div v-else-if="!loading" >
											<Button class="mr-2" @click="() => outboundEditor = false" size="small" icon="pi pi-angle-left" outlined ></Button>
											<Button :disabled="!addOutEnabled" @click="commitOut(true,false)" v-tooltip="'Save Outbound'"  size="small" icon="pi pi-check" ></Button>
										</div>
									</div>
								</h6>
								<ul v-if="outboundEditor" class="list-none p-0 m-0">
										<FormItem label="Endpoint">
											<Chip class="pl-0 pr-3 mr-2">
													<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
														<i class="pi pi-chart-scatter"/>
													</span>
													<span class="font-medium">
														<Select
														 :disabled="!!props.pid"
															v-model="outbound.ep" 
															:options="endpoints" 
															optionLabel="name" 
															optionValue="id"
															placeholder="Endpoint" 
															class="flex"></Select>
													</span>
											</Chip>
										</FormItem>
										<FormItem label="Targets">
											<ChipList icon="pi-desktop" placeholder="Host:Port" v-model:list="outbound.targets" />
										</FormItem>
										<FormItem label="Entrances"  :border="false">
												<Chip class="pl-0 pr-3 mr-2">
														<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
															<i class="pi pi-chart-scatter"/>
														</span>
														<span class="font-medium">
															<MultiSelect
																v-model="outbound.entrances" 
																:options="endpoints" 
																optionLabel="name" 
																optionValue="id"
																:filter="endpoints.length>=8"
																placeholder="Endpoints" 
																class="flex" :maxSelectedLabels="3"></MultiSelect>
													</span>
											</Chip>
										</FormItem>
									</ul>
									<DataView v-else :value="outbounds">
										<template #empty>
											No outbounds.
										</template>
										<template #list="slotProps">
										
											<div class="surface-border py-3" :class="{'border-top-1':index>0}" v-for="(item, index) in slotProps.items" :key="index">
													<div class="flex py-2 gap-4" :class="{ 'border-t border-surface-200 dark:border-surface-700': index !== 0 }">
															<div class="flex-item flex flex-col justify-between items-start gap-2">
																	<div>
																			<div class="text-lg font-medium mt-2"><Tag v-if="info.endpoint?.id == item.ep?.id" class="mr-2" severity="contrast" >Local</Tag> {{ item.ep?.name }} </div>
																	</div>
															</div>
															<div class="flex flex-col md:items-end gap-4">
																<div>
																	<div  class="flex flex-col gap-4 mb-2">	
																		<span class="font-semibold w-6rem text-right">Targets:</span>
																		<span class="text-xl font-semibold"><Tag class="block" :class="{'mt-1':idx==1}" v-for="(target,idx) in item.targets" :value="target" severity="secondary" /></span>
																	</div>	
																	<div  class="flex flex-col gap-4">
																		<span class="font-semibold w-6rem text-right" v-if="item.entrances && item.entrances.length>0">Entrances:</span>
																		<span class="text-xl font-semibold" v-if="item.entrances && item.entrances.length>0"><Tag class="block" :class="{'mt-1':idx==1}" v-for="(entrance,idx) in item.entrances" :value="props.endpointMap[entrance]?.name || props.endpointMap[entrance]?.username || props.endpointMap[entrance]?.id" severity="secondary" /></span>
																	</div>
																</div>	
																	<div class="flex flex-row-reverse md:flex-row gap-2 pl-4">
																		<Button @click="outboundRemove(item,index)" size="small" icon="pi pi-trash" outlined></Button>
																		<Button v-if="!!props.d" @click="outboundEdit(item,index)" size="small" icon="pi pi-pencil" class="flex-auto md:flex-initial whitespace-nowrap"></Button>
																	</div>
															</div>
													</div>
											</div>
										</template>
									</DataView>
								</div>
						</div>
					</div>
				</BlockViewer>
			</ScrollPanel>
		</div>
	</div>
</template>

<style scoped lang="scss">
:deep(.p-breadcrumb){
	border-radius: 0;
	border-left: none;
	border-right: none;
}
.bootstrap{
	:deep(.add-tag-input){
		width:120px;
	}
	:deep(.add-tag-input:hover){
		width:160px;
	}
}
</style>
