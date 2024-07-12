<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import ZtmService from '@/service/ZtmService';
import { useRoute } from 'vue-router'
import { useToast } from "primevue/usetoast";
import { isAdmin } from "@/service/common/authority-utils";
import { useStore } from 'vuex';
import _ from "lodash"

const props = defineProps(['embed','pid','mesh','ep','proto','title']);
const emits = defineEmits(['save','back']);
const store = useStore();
const selected = ref(props.mesh);
const endpoints = ref([]);
const route = useRoute();
const toast = useToast();
const ztmService = new ZtmService();
const loading = ref(false);
const scope = ref('public');
const newTunnel = {
	name: "",
	protocol: "tcp",
}
const tunnel = ref(_.cloneDeep(newTunnel));
const agentId = computed(()=>{
	const find = [].filter((mesh) => mesh.name == selected.value);
	return find?.agent?.id;
})
const getEndpoints = () => {
	if(!selected.value){
		return;
	}
	ztmService.getEndpoints(selected.value)
		.then(res => {
			console.log("Endpoints:")
			console.log(res)
			endpoints.value = res || [];
			endpoints.value.forEach((ep)=>{
				ep.label = ep.name || ep.username || 'Unknow EP'
			})
			if(!props.pid){
				if(!!res.find((ep)=> ep.id == agentId)){
					tunnel.value.ep = agentId;
				} else {
					tunnel.value.ep = res[0].id;
				}
			}
		})
		.catch(err => console.log('Request Failed', err)); 
}
const enabled = computed(() => {
	return !!tunnel.value.name
	&& ( 
		(outbound.value.targets.length>0 && outbound.value.endpoint) 
		|| (inbound.value.listens.length>0&& inbound.value.endpoint)  
	);
});
watch(()=> selected,()=>{
	getEndpoints();
},{
	immediate: true,
	deep:true,
})
const commit = () => {
	loading.value = true;
	ztmService.createService({
		mesh: selected.value,
		ep: tunnel.value.ep,
		name: tunnel.value.name,
		proto: tunnel.value.protocol,
	})
		.then(res => {
			loading.value = false;
			if(res){
				toast.add({ severity: 'success', summary:'Tips', detail: 'Create successfully.', life: 3000 });
				emits("save", tunnel.value);
				tunnel.value = _.cloneDeep(newTunnel);
			}
		})
		.catch(err => {
			loading.value = false;
			console.log('Request Failed', err)
		}); 
}
const home = ref({
    icon: 'pi pi-desktop'
});
onMounted(() => {
	if(!!props.pid){
		loaddata()
	} else {
		tunnel.value = _.cloneDeep(newTunnel);
	}
});
const error = ref();
const loaddata = () => {
	loading.value = true;
			console.log({
		name:props.pid,
		ep:props.ep,
		mesh:props.mesh,
		proto:props.proto,
	});
	ztmService.getService({
		name:props.pid,
		ep:props.ep,
		mesh:props.mesh,
		proto:props.proto,
	})
		.then(res => {
			console.log("getService loaddata");
			console.log(res);
			loading.value = false;
			tunnel.value = res;
			tunnel.value.ep = props.ep;
			error.value = null;
		})
		.catch(err => {
			error.value = err;
			console.log("getService catch");
			console.log(err);
			loading.value = false;
		}); 
}
const active = ref(0);

const back = () => {
	emits('back')
}
const windowWidth = computed(() =>  window.innerWidth);
const isMobile = computed(() => windowWidth.value<=768);
const newOutbound = {
	name: null,
	proto: null,
	ep: null,
	targets: [],
	entrances: [],
}
const outbound = ref(newOutbound)
const outbounds = ref([{
	ep:{name:"xxx",id:"aaa-bbb-ccc"}, proto:"TCP", name:"AAA", targets:["127.0.0.1:8080"], entrances: ["aaa-bbb-ccc"]
}])

const newInbound = {
	name: null,
	proto: null,
	ep: null,
	listens: [],
	exits: [],
}
const inbound = ref(newInbound)
const inbounds = ref([{
	ep:{name:"xxx",id:"aaa-bbb-ccc"}, proto:"TCP", name:"AAA", listens:["127.0.0.1:8080"], exits: ["aaa-bbb-ccc"]
}])
const editor = ref();
const openEdit = (index) => {
	editor.value = index;
}
</script>

<template>

	<div class="surface-ground h-full" :style="{'minHeight':`calc(100vh - ${props.embed?'100px':'20px'})`}">
		<AppHeader :back="back">
				<template #center>
					<b>{{props.title||'New Tunnel'}}</b>
				</template>
		
				<template #end> 
					<Button v-if="!props.title" :loading="loading" :disabled="!enabled" label="Create" aria-label="Submit" size="small" @click="commit"/>
				</template>
		</AppHeader>
		<div class="md:m-3 h-full relative">
		<ScrollPanel class="w-full absolute" style="top:0px;bottom: 0;">
		<Empty v-if="error" :error="error"/>
		<BlockViewer v-else containerClass="surface-section px-1 md:px-1 md:pb-7 lg:px-1" >
			
			<Button v-if="!!props.title && !loading && active>0 && !editor" @click="openEdit(active)" v-tooltip="active==1?'Add Inbound':'Add Outbound'" size="small" icon="pi pi-plus" class="absolute" style="right: 30px;top:10px;z-index: 10;"></Button>
			<div v-else-if="!!props.title && !loading && active>0" class="absolute" style="right: 30px;top:10px;z-index: 10;">
				<Button class="mr-2" @click="() => editor = null" size="small" icon="pi pi-angle-left" outlined ></Button>
				<Button @click="save(active)" v-tooltip="active==1?'Save Inbound':'Save Outbound'"  size="small" icon="pi pi-check" ></Button>
			</div>
			
			<Loading v-if="loading" />
			<TabView @tabChange="() => editor = null" class="relative" v-else v-model:activeIndex="active">
				<TabPanel>
					<template #header><i class="pi pi-cog mr-2"/>Metadata</template>
					<div>
						<ul class="list-none p-0 m-0">
							<FormItem label="Tunnel">
								<Chip class="pl-0 pr-3 mr-2">
										<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
											<i class="pi pi-bookmark"/>
										</span>
										<span class="ml-2 font-medium">
											<InputText :disabled="!!props.pid" placeholder="Name your tunnel" class="add-tag-input xxl" :unstyled="true" v-model="tunnel.name" type="text" />
										</span>
								</Chip>
							</FormItem>
							<FormItem label="Protocol">
								<Chip class="pl-0 pr-3">
										<span class="border-circle w-2rem h-2rem flex align-items-center justify-content-center">
											<RadioButton  :disabled="!!props.pid" v-model="tunnel.protocol" inputId="scopeType2" name="scopeType" value="tcp" />
										</span>
										<span class="ml-2 font-medium">TCP</span>
								</Chip>
								<Chip class="ml-2 pl-0 pr-3">
										<span class="border-circle w-2rem h-2rem flex align-items-center justify-content-center">
											<RadioButton  :disabled="!!props.pid" v-model="tunnel.protocol" inputId="scopeType3" name="scopeType" value="udp" />
										</span>
										<span class="ml-2 font-medium">UDP</span>
								</Chip>
							</FormItem>
						</ul>
					</div>
				</TabPanel>
				
				<TabPanel>
					<template #header>
						<i class="pi pi-sign-in mr-2"/>Inbounds
						<Badge v-if="!!props.title" class="relative" style="left: 10px;" :value="outbounds.length" />
					</template>
					<div class="surface-section" >
					</div>
				</TabPanel>
				<TabPanel>
					<template #header>
						<i class="pi pi-sign-out mr-2"/>Outbounds 
						<Badge  v-if="!!props.title" class="relative" style="left: 10px;" :value="outbounds.length" />
					</template>
					<div class="surface-section" >
						<ul v-if="!!editor || !props.title" class="list-none p-0 m-0">
							<FormItem label="Endpoint">
								<Chip class="pl-0 pr-3 mr-2">
										<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
											<i class="pi pi-chart-scatter"/>
										</span>
										<span class="font-medium">
											<Select
											 :disabled="!!props.pid"
												v-model="tunnel.ep" 
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
							<FormItem label="Entrances">
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
							<template #list="slotProps">
								<div v-for="(item, index) in slotProps.items" :key="index">
										<div class="flex p-2 gap-4" :class="{ 'border-t border-surface-200 dark:border-surface-700': index !== 0 }">
												<div class="flex-item flex flex-col justify-between items-start gap-2">
														<div>
																<span class="font-medium text-surface-500 dark:text-surface-400 text-sm">{{ item.ep?.name }}</span>
																<div class="text-lg font-medium mt-2">{{ item.name }}</div>
														</div>
														<div class="bg-surface-100 p-1" style="border-radius: 30px">
																<div v-tooltip="item.entrances" class="bg-surface-0 flex items-center gap-2 justify-center py-1 px-2" style="border-radius: 30px; box-shadow: 0px 1px 2px 0px rgba(0, 0, 0, 0.04), 0px 1px 2px 0px rgba(0, 0, 0, 0.06)">
																		<span class="text-surface-900 font-medium text-sm">{{ item.entrances.length }}</span>
																		<i class="pi pi-star-fill text-yellow-500"></i>
																</div>
														</div>
												</div>
												<div class="flex flex-col md:items-end gap-8">
														<span class="text-xl font-semibold">{{ item.listens }}</span>
														<div class="flex flex-row-reverse md:flex-row gap-2">
																<Button size="small" icon="pi pi-trash" outlined></Button>
																<Button size="small" icon="pi pi-pencil" class="flex-auto md:flex-initial whitespace-nowrap"></Button>
														</div>
												</div>
										</div>
								</div>
							</template>
					</DataView>
					</div>
				</TabPanel>
				
			</TabView>
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
