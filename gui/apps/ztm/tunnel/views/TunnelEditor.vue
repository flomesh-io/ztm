<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { merge } from '@/service/common/request';
import TunnelService from '../service/TunnelService';
import { useRoute } from 'vue-router'
import { useToast } from "primevue/usetoast";
import { useStore } from 'vuex';
import _ from "lodash"
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
const props = defineProps(['d']);
const emits = defineEmits(['save','back']);
const store = useStore();
const route = useRoute();
const toast = useToast();
const tunnelService = new TunnelService();
const info = computed(() => {
	return store.getters['app/info']
});
const loading = ref(false);
const newTunnel = {
	name: "",
	protocol: "tcp",
}
const tunnel = ref(_.cloneDeep(newTunnel));
const newOutbound = {
	name: null,
	protocol: null,
	ep: info.value.endpoint?.id,
	targets: [],
	entrances: [],
	users: [],
}
const outbound = ref(_.cloneDeep(newOutbound))
const outbounds = ref([])

const newInbound = {
	name: null,
	protocol: null,
	ep: info.value.endpoint?.id,
	listens: [],
	exits: [],
}
const inbound = ref(_.cloneDeep(newInbound))
const inbounds = ref([])

const enabled = computed(() => {
	return !!tunnel.value.name
	&& ( 
		(outbounds.value.length>0) 
		|| (inbounds.value.length>0)  
	);
});
const addInEnabled = computed(() => {
	return inbound.value.listens.length>0 && !!inbound.value.listens[0]?.value && inbound.value.ep;
});
const addOutEnabled = computed(() => {
	return outbound.value.targets.length>0 && !!outbound.value.targets[0] && outbound.value.ep;
});
const error = ref();
const back = () => {
	emits('back')
}
const inboundEditor = ref(false);
const outboundEditor = ref(false);
const createTunnel = () => {
	const reqs = [];
	let errors =0;
	inbounds.value.forEach((_inbound)=>{
		if(_inbound.listens.length>0 && !!_inbound.listens[0] && _inbound.ep){
			reqs.push(tunnelService.createInbound({
				..._inbound,
				protocol: tunnel.value.protocol, 
				name: tunnel.value.name,
				ep:_inbound.ep?.id
			}).catch((e)=>{
				errors++;
			}))
		}
	})
	
	outbounds.value.forEach((_outbound)=>{
		if(_outbound.targets.length>0 && !!_outbound.targets[0] && _outbound.ep){
			reqs.push(tunnelService.createOutbound({
				..._outbound,
				protocol: tunnel.value.protocol, 
				name: tunnel.value.name,
				ep:_outbound.ep?.id
			}).catch((e)=>{
				errors++;
			}))
		}
	})
	return merge(reqs).then((allRes) => {
		outboundEditor.value = false;
		inboundEditor.value = false;
		loading.value = false;
		if(errors == 0){
			toast.add({ severity: 'success', summary:t('Tips'), detail: t('Save successfully.'), life: 3000 });
		}else if(reqs.length > errors){
			toast.add({ severity: 'contrast', summary:t('Tips'), detail: t('Partially saved successfully.'), life: 3000 });
		}
		setTimeout(()=>{
			emits("save",tunnel.value);
		},1000);
	})
}
const commitIn = () => {
	if(!props.d){
		inbounds.value.push({
			...inbound.value,
			protocol: tunnel.value.protocol, 
			name: tunnel.value.name,
			ep:{id:inbound.value.ep}
		});
		inboundEditor.value = false;
		inbound.value = _.cloneDeep(newInbound);
		return;
	}
	if(inbound.value.listens.length>0 && !!inbound.value.listens[0] && inbound.value.ep){
		
		loading.value = true;
		tunnelService.createInbound({
			...inbound.value,
			protocol: tunnel.value.protocol, 
			name: tunnel.value.name
		})
			.then(res => {
				inboundEditor.value = false;
				loading.value = false;
				inbound.value = _.cloneDeep(newInbound);
				toast.add({ severity: 'success', summary:t('Tips'), detail: t('Save successfully.'), life: 3000 });
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
			protocol: tunnel.value.protocol, 
			name: tunnel.value.name,
			ep:{id:outbound.value.ep}
		});
		outboundEditor.value = false;
		outbound.value = _.cloneDeep(newOutbound);
		return;
	}
	if(outbound.value.targets.length>0 && !!outbound.value.targets[0] && outbound.value.ep){
		
		loading.value = true;
		tunnelService.createOutbound({
			...outbound.value,
			protocol: tunnel.value.protocol, 
			name: tunnel.value.name
		})
			.then(res => {
				loading.value = false;
				outboundEditor.value = false;
				outbound.value = _.cloneDeep(newOutbound);
				toast.add({ severity: 'success', summary:t('Tips'), detail: t('Save successfully.'), life: 3000 });
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
	if(!!props.d){
		tunnelService.getTunnel(props.d).then((res)=>{
			console.log('getTunnel',res);
			tunnel.value = res;
			inbounds.value = res.inbounds;
			outbounds.value = res.outbounds;
		})
	} else {
		tunnel.value = _.cloneDeep(newTunnel);
		inbound.value = _.cloneDeep(newInbound);
		outbound.value = _.cloneDeep(newOutbound);
	}
	// if(!props.d){
	// 	tunnel.value = _.cloneDeep(newTunnel);
	// 	inbound.value = _.cloneDeep(newInbound);
	// 	outbound.value = _.cloneDeep(newOutbound);
	// } else {
	// 	tunnel.value = props.d;
	// 	inbounds.value = props.d.inbounds;
	// 	outbounds.value = props.d.outbounds;
	// }
}

const inboundCreate = (t,index) => {
	inboundEditor.value = true;
	inbound.value = _.cloneDeep(newInbound);
	inboundRestrict.value = false;
}
const outboundCreate = (t,index) => {
	outboundEditor.value = true;
	outbound.value = _.cloneDeep(newOutbound);
	outboundRestrict.value = false;
}

const inboundEdit = (t,index) => {
	inboundEditor.value = true;
	inbound.value = _.cloneDeep(t);
	inbound.value.ep = t.ep?.id;
	inboundRestrict.value = !!inbound.value?.exits && inbound.value?.exits.length>0;
}
const outboundEdit = (t,index) => {
	outboundEditor.value = true;
	outbound.value = _.cloneDeep(t);
	outbound.value.ep = t.ep?.id;
	outboundRestrict.value = (!!outbound.value?.entrances && outbound.value?.entrances.length>0) || (!!outbound.value?.users && outbound.value?.users.length>0);
}
const inboundRemove = (t,index) => {
	if(!props.d){
		inbounds.value.splice(index,1)
	} else {
		tunnelService.deleteInbound({
			ep:t.ep?.id, protocol:tunnel.value.protocol, name:tunnel.value.name
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
			ep:t.ep?.id, protocol:tunnel.value.protocol, name:tunnel.value.name
		},()=>{
			emits("save",tunnel.value);
		})
	}
}

const visibleOutboundType = ref(false);
const inboundRestrict = ref(false);
const outboundRestrict = ref(false);
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

	<div class="surface-ground h-full min-h-screen relative">
		<AppHeader :back="back">
				<template #center>
					 <b>{{props.d?`${props.d?.protocol}/${props.d?.name}`:'New Tunnel'}}</b>
				</template>
		
				<template #end> 
					<Button v-if="!props.d" :loading="loading" :disabled="!enabled" :label="t('Create')" aria-label="Submit" size="small" @click="createTunnel"/>
				</template>
		</AppHeader>
		<ScrollPanel class="absolute-scroll-panel md:p-3" style="bottom: 0;">
			<Empty v-if="error" :error="error"/>
			<BlockViewer v-else containerClass="surface-section px-1 md:px-1 md:pb-7 lg:px-1" >
				<Loading v-if="loading" />
				<div v-else class="surface-ground surface-section h-full p-4" >
						<div class="mb-4" v-if="!props.d">
							<h6>
								<Tag>{{t('Tunnel')}}</Tag>
							</h6>
							<div class="grid" >
								<div class="col-12 md:col-6">
									<FormItem :label="t('Name')" :border="false">
										<Chip class="pl-0 pr-3 mr-2">
												<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<i class="pi pi-bookmark"/>
												</span>
												<span class="ml-2 font-medium">
													<InputText :disabled="!!props.d" :placeholder="t('Name your tunnel')" class="add-tag-input xxl" :unstyled="true" v-model="tunnel.name" type="text" />
												</span>
										</Chip>
									</FormItem>
								</div>
								<div class="col-12 md:col-6">
									<FormItem :label="t('Protocol')" :border="false">
										<Chip class="pl-0 pr-3">
												<span class="border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<RadioButton  :disabled="!!props.d" v-model="tunnel.protocol" inputId="scopeType2" name="scopeType" value="tcp" />
												</span>
												<span class="ml-2 font-medium">TCP</span>
										</Chip>
										<Chip class="ml-2 pl-0 pr-3">
												<span class="border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<RadioButton  :disabled="!!props.d" v-model="tunnel.protocol" inputId="scopeType3" name="scopeType" value="udp" />
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
										<Tag >{{t('Inbound')}}
											<Badge v-if="!!props.d" :value="inbounds.length" />
										</Tag> 
									</div>
									<div class="flex-item text-right">
										<Button 
											v-if="!loading && !inboundEditor" 
											@click="inboundCreate" 
											v-tooltip.left="t('Add Inbound')" 
											size="small" 
											icon="pi pi-plus" ></Button>
										<div v-else-if="!loading" >
											<Button class="mr-2" @click="() => inboundEditor = false" size="small" icon="pi pi-angle-left" outlined ></Button>
											<Button :disabled="!addInEnabled" @click="commitIn()" v-tooltip="t('Save Inbound')"  size="small" icon="pi pi-check" ></Button>
										</div>
									</div>
								</h6>
								<ul v-if="inboundEditor" class="list-none p-0 m-0">
									<FormItem :label="t('Endpoint')">
										<Chip class="pl-0 pr-3 mr-2">
												<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<i class="pi pi-chart-scatter"/>
												</span>
												<span class="font-medium">
													<EpSelector 
														:app="true" 
														:disabled="!!props.pid"
														:multiple="false" 
														:endpoint="info?.endpoint" 
														v-model="inbound.ep" />
												</span>
										</Chip>
									</FormItem>
									<FormItem :label="t('Listens')">
										<ChipList direction="v" icon="pi-desktop" :placeholder="t('ip:port')" v-model:list="inbound.listens" listKey="value"/>
									</FormItem>
									<FormItem label=""  :border="inboundRestrict">
										<ToggleSwitch  class="vm" v-model="inboundRestrict" inputId="inboundRestrict"/><label for="inboundRestrict" class="vm ml-2">{{t('Restrict access')}}</label>
									</FormItem>
									<FormItem v-if="inboundRestrict" :label="t('Allowed Exits')"  :border="false">
											<Chip class="pl-0 pr-3 mr-2">
													<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
														<i class="pi pi-chart-scatter"/>
													</span>
													<span class="font-medium">
														<EpSelector 
															:app="true" 
															:multiple="true" 
															:endpoint="info?.endpoint" 
															v-model="inbound.exits" />
												</span>
										</Chip>
									</FormItem>
								</ul>
								<DataView class="transparent" v-else :value="inbounds">
										<template #empty>
											{{t('No inbound.')}}
										</template>
									<template #list="slotProps">
										<div class="surface-border py-3" :class="{'border-top-1':index>0}" v-for="(item, index) in slotProps.items" :key="index">
												<div class="flex py-2 gap-4" :class="{ 'border-t border-surface-200 dark:border-surface-700': index !== 0 }">
														<div class="flex flex-col pr-2 ">
															<div class="text-lg font-medium align-items-start flex flex-column" style="justify-content: start;">
																<Ep :endpoint="item.ep?.id" />
																<Tag v-if="info.endpoint?.id == item.ep?.id"  severity="contrast" >{{t('Local')}}</Tag>
															</div>
														</div>
														<div class="flex flex-item gap-2 justify-content-center">
															<div>
																<div class="font-semibold w-6rem text-left">{{t('Listens')}}:</div>
																<div >
																	<Tag class="block" style="white-space: nowrap;" :class="{'mt-1':idx==1}" v-for="(listen,idx) in item.listens.filter((listen)=> !!listen?.value)" severity="secondary" >
																		<Status v-if="listen?.open != null" :run="!!listen?.open" :errors="listen?.error" />
																		{{ listen.value }}
																	</Tag>
																</div>
															</div>
															<div v-if="item.exits && item.exits.length>0">
																<div class="font-semibold w-6rem" >{{t('Exits')}}:</div>
																<div>
																	<Tag class="block" :class="{'mt-1':idx==1}" v-for="(exit,idx) in item.exits" severity="secondary" >
																		<Ep :endpoint="exit"/>
																	</Tag>
																</div>
															</div>
														</div>
														<div class="flex flex-column xl:flex-row-reverse  xl:flex-row gap-2">
																<Button v-if="!!props.d" @click="inboundEdit(item,index)" size="small" icon="pi pi-pencil" class="flex-auto md:flex-initial whitespace-nowrap"></Button>
																<Button @click="inboundRemove(item,index)" size="small" icon="pi pi-trash" outlined></Button>
														</div>
												</div>
										</div>
									</template>
								</DataView>
							</div>
							<div class="col-12 md:col-6">
								<h6 class="flex">
									<div>
										<Tag >{{t('Outbound')}}
											<Badge v-if="!!props.d" :value="outbounds.length" />
										</Tag> 
									</div>
									<div class="flex-item text-right">
										<Button 
											v-if="!loading && !outboundEditor" 
											@click="outboundCreate" 
											v-tooltip.left="t('Add Outbound')" 
											size="small" 
											icon="pi pi-plus" ></Button>
										<div v-else-if="!loading" >
											<Button class="mr-2" @click="() => outboundEditor = false" size="small" icon="pi pi-angle-left" outlined ></Button>
											<Button :disabled="!addOutEnabled" @click="commitOut(true,false)" v-tooltip="t('Save Outbound')"  size="small" icon="pi pi-check" ></Button>
										</div>
									</div>
								</h6>
								<ul v-if="outboundEditor" class="list-none p-0 m-0">
										<FormItem :label="t('Endpoint')">
											<Chip class="pl-0 pr-3 mr-2">
													<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
														<i class="pi pi-chart-scatter"/>
													</span>
													<span class="font-medium">
														<EpSelector 
															:app="true" 
															:disabled="!!props.pid"
															:multiple="false" 
															:endpoint="info?.endpoint" 
															v-model="outbound.ep" />
													</span>
											</Chip>
										</FormItem>
										<FormItem :label="t('Targets')">
											<ChipList direction="v" icon="pi-desktop" :placeholder="t('Host:Port')" v-model:list="outbound.targets" />
										</FormItem>
										
										<FormItem label=""  :border="outboundRestrict">
											<ToggleSwitch  class="vm" v-model="outboundRestrict" inputId="outboundRestrict"/><label for="outboundRestrict" class="vm ml-2">{{t('Restrict access')}}</label>
										</FormItem>
										<FormItem v-if="outboundRestrict" :label="t('Allowed Entrances')" >
												<Chip class="pl-0 pr-3 mr-2">
														<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
															<i class="pi pi-chart-scatter"/>
														</span>
														<span class="font-medium">
															<EpSelector 
																:app="true" 
																:multiple="true" 
																:endpoint="info?.endpoint" 
																v-model="outbound.entrances" />
													</span>
											</Chip>
										</FormItem>
										<FormItem v-if="outboundRestrict" :label="t('Users')"  :border="false">
												<Chip class="pl-0 pr-3 mr-2">
														<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
															<i class="pi pi-users"/>
														</span>
														<span class="font-medium">
															<UserSelector 
																:app="true" 
																:multiple="true" 
																:user="info?.username" 
																v-model="outbound.users" />
													</span>
											</Chip>
										</FormItem>
										
									</ul>
									<DataView  class="transparent" v-else :value="outbounds">
										<template #empty>
											{{t('No outbound.')}}
										</template>
										<template #list="slotProps">
										
											<div class="surface-border py-3" :class="{'border-top-1':index>0}" v-for="(item, index) in slotProps.items" :key="index">
													<div class="flex py-2 gap-4 md:gap-1" :class="{ 'border-t border-surface-200 dark:border-surface-700': index !== 0 }">
															<div class="flex flex-col justify-between items-start pr-2 ">
																	<div class="text-lg font-medium align-items-start flex flex-column" style="justify-content: start;">
																			<Ep :endpoint="item.ep?.id" />
																			<Tag v-if="info.endpoint?.id == item.ep?.id" severity="contrast" >{{t('Local')}}</Tag>
																	</div>
															</div>
															<div class="flex flex-item gap-2 justify-content-center">
																<div  class="flex flex-column" >
																	<div class="font-semibold w-5rem">{{t('Targets')}}:</div>
																	<div ><Tag class="block" :class="{'mt-1':idx==1}" v-for="(target,idx) in item.targets.filter((target)=> !!target)" :value="target" severity="secondary" /></div>
																</div>	
																<div  class="flex flex-column" v-if="item.entrances && item.entrances.length>0">
																	<div class="font-semibold w-5rem " >{{t('Entrances')}}:</div>
																	<div >
																		<Tag class="block" :class="{'mt-1':idx==1}" v-for="(entrance,idx) in item.entrances" severity="secondary" >
																			<Ep :endpoint="entrance"/>
																		</Tag>
																	</div>
																</div>
																<div class="flex flex-column " v-if="item.users && item.users.length>0">
																	<div class="font-semibold w-5rem ">{{t('Users')}}:</div>
																	<div ><Tag class="block" :class="{'mt-1':idx==1}" v-for="(user,idx) in item.users" :value="user" severity="secondary" /></div>
																</div>
															</div>
															<div class="flex flex-column xl:flex-row-reverse xl:flex-row gap-2">
																<Button v-if="!!props.d" @click="outboundEdit(item,index)" size="small" icon="pi pi-pencil" class="flex-auto md:flex-initial whitespace-nowrap"></Button>
																<Button @click="outboundRemove(item,index)" size="small" icon="pi pi-trash" outlined></Button>
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
:deep(.p-accordioncontent-content){
	padding: 0;
}
</style>
