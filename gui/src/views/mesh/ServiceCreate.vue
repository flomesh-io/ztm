<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import PipyProxyService from '@/service/PipyProxyService';
import MeshSelector from './common/MeshSelector.vue'
import { useRoute } from 'vue-router'
import { useToast } from "primevue/usetoast";
import { isAdmin } from "@/service/common/authority-utils";
import { useStore } from 'vuex';
import _ from "lodash"

const props = defineProps(['pid','mesh','ep','proto','title']);
const emits = defineEmits(['save','cancel']);
const store = useStore();
const meshes = computed(() => {
	return store.getters['account/meshes']
});
const selected = ref(props.mesh);
const endpoints = ref([]);
const route = useRoute();
const toast = useToast();
const pipyProxyService = new PipyProxyService();
const loading = ref(false);
const scope = ref('public');
const newConfig = {
	name: "",
	protocol: "tcp",
	host:'127.0.0.1',
	ep: null,
	users:[],
	port:null
}
const config = ref(_.cloneDeep(newConfig));
const agentId = computed(()=>{
	const find = meshes.value.filter((mesh) => mesh.name == selected.value);
	return find?.agent?.id;
})
const getEndpoints = () => {
	if(!selected.value){
		return;
	}
	pipyProxyService.getEndpoints(selected.value)
		.then(res => {
			console.log("Endpoints:")
			console.log(res)
			endpoints.value = res || [];
			if(!props.pid){
				if(!!res.find((ep)=> ep.id == agentId)){
					config.value.ep = agentId;
				} else {
					config.value.ep = res[0].id;
				}
			}
		})
		.catch(err => console.log('Request Failed', err)); 
}
const enabled = computed(() => {
	return selected.value && config.value.name.length>0 && selected.value && !!agentId;
});
watch(()=> selected,()=>{
	getEndpoints();
},{
	immediate: true,
	deep:true,
})
const commit = () => {
	loading.value = true;
	pipyProxyService.createService({
		mesh: selected.value,
		ep: config.value.ep,
		name: config.value.name,
		proto: config.value.protocol,
		host: config.value.host,
		port: config.value.port,
		users: scope.value == 'public'?null:(config.value.users||[])
	})
		.then(res => {
			loading.value = false;
			if(res){
				toast.add({ severity: 'success', summary:'Tips', detail: 'Create successfully.', life: 3000 });
				emits("save", config.value);
				config.value = _.cloneDeep(newConfig);
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
		config.value = _.cloneDeep(newConfig);
	}
});
const loaddata = () => {
	loading.value = true;
	pipyProxyService.getService({
		name:props.pid,
		ep:props.ep,
		mesh:props.mesh,
		proto:props.proto,
	})
		.then(res => {
			console.log(res);
			loading.value = false;
			config.value = res;
			config.value.ep = props.ep;
			if(res.users == null){
				scope.value = 'public';
				config.value.users = [];
			} else {
				scope.value = 'private';
			}
		})
		.catch(err => {
			loading.value = false;
		}); 
}
const cancel = () => {
	emits("cancel");
}
const active = ref(0);
</script>

<template>
	<div v-if="route.params?.id" style="padding-left: 0px;padding-top: 0;padding-right: 0;m">
		<Breadcrumb :home="home" :model="[{label:route.params?.id}]" />
	</div>
	<div >
		<BlockViewer text="Json" :header="props.title||'Create Service'" containerClass="surface-section px-1 py-3 md:px-1 md:pb-7 lg:px-1" >
			<template #actions>
				<Button class="mr-2" severity="secondary" v-if="!!props.pid" label="Cancel" size="small" @click="cancel"/>
				<Button :loading="loading" :disabled="!enabled" label="Save" aria-label="Submit" size="small" @click="commit"/>
			</template>
			<Loading v-if="loading" />
			<TabView v-else class="tabview-vertical" v-model:activeIndex="active">
				<TabPanel>
					<template #header><i class="pi pi-cog mr-2"/>Config</template>
					<div class="surface-section pl-4">
						<ul class="list-none p-0 m-0">
							<li class="flex align-items-center py-3 px-2  border-bottom-1 surface-border flex-wrap">
									<div class="text-tip w-6 md:w-2 font-medium">Service</div>
									<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
										<Chip class="pl-0 pr-3 mr-2">
												<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<i class="pi pi-bookmark"/>
												</span>
												<span class="ml-2 font-medium">
													<InputText :disabled="!!props.pid" placeholder="Name your service" class="add-tag-input xl" :unstyled="true" v-model="config.name" type="text" />
												</span>
										</Chip>
									</div>
							</li>
							<li class="flex align-items-center py-3 px-2  border-bottom-1 surface-border flex-wrap">
									<div class="text-tip w-6 md:w-2 font-medium">Mesh</div>
									<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
										
										<Chip class="pl-0 pr-3 mr-2">
												<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<i class="pi pi-globe"/>
												</span>
												<span class="font-medium">
													<MeshSelector 
														:form="true" 
														:full="true" 
														v-model="selected"
														 :disabled="!!props.pid"
														innerClass="flex"/>
												</span>
										</Chip>
									</div>
							</li>
							<li class="flex align-items-center py-3 px-2  border-bottom-1 surface-border flex-wrap">
									<div class="text-tip w-6 md:w-2 font-medium">Endpoint</div>
									<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
										<Chip class="pl-0 pr-3 mr-2">
												<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<i class="pi pi-chart-scatter"/>
												</span>
												<span class="font-medium">
													<Select
													 :disabled="!!props.pid"
														v-model="config.ep" 
														:options="endpoints" 
														optionLabel="name" 
														optionValue="id"
														placeholder="Endpoint" 
														class="flex"></Select>
												</span>
										</Chip>
									</div>
							</li>
							<li class="flex align-items-center py-3 px-2 surface-border flex-wrap border-bottom-1">
									<div class="text-tip w-6 md:w-2 font-medium">Protocol</div>
									<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1 bootstrap">
										<Chip class="pl-0 pr-3">
												<span class="border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<RadioButton  :disabled="!!props.pid" v-model="config.protocol" inputId="scopeType2" name="scopeType" value="tcp" />
												</span>
												<span class="ml-2 font-medium">TCP</span>
										</Chip>
										
										<Chip class="ml-2 pl-0 pr-3">
												<span class="border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<RadioButton  :disabled="!!props.pid" v-model="config.protocol" inputId="scopeType3" name="scopeType" value="udp" />
												</span>
												<span class="ml-2 font-medium">UDP</span>
										</Chip>
									</div>
							</li>
							<li class="flex align-items-center py-3 px-2  border-bottom-1 surface-border flex-wrap">
									<div class="text-tip w-6 md:w-2 font-medium">Host</div>
									<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
										<Chip class="pl-0 pr-3 mr-2">
												<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<i class="pi pi-bookmark"/>
												</span>
												<span class="ml-2 font-medium">
													<InputText placeholder="Name" class="add-tag-input xl" :unstyled="true" v-model="config.host" type="text" />
												</span>
										</Chip>
									</div>
							</li>
							<li class="flex align-items-center py-3 px-2  surface-border flex-wrap">
									<div class="text-tip w-6 md:w-2 font-medium">Port</div>
									<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
										<Chip class="pl-0 pr-3 mr-2">
												<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<i class="pi pi-sort"/>
												</span>
												<span class="ml-2 font-medium">
													<InputNumber :useGrouping="false" :min="1" :max="65535" placeholder="1-65535" class="add-tag-input" :unstyled="true" v-model="config.port" type="text" />
												</span>
										</Chip>
									</div>
							</li>
						</ul>
					</div>
				</TabPanel>
				<TabPanel>
					<template #header><i class="pi pi-shield mr-2"/>Security</template>
					<div class="surface-section pl-4">
						<ul class="list-none p-0 m-0">
							<li class="flex align-items-center py-3 px-2  surface-border flex-wrap">
									<div class="text-tip w-6 md:w-2 font-medium">Scope</div>
									<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1 bootstrap">
										<Chip class="pl-0 pr-3">
												<span class="border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<RadioButton  v-model="scope" inputId="scopeType2" name="scopeType" value="public" />
												</span>
												<span class="ml-2 font-medium">Public</span>
										</Chip>
										
										<Chip class="ml-2 pl-0 pr-3">
												<span class="border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<RadioButton  v-model="scope" inputId="scopeType3" name="scopeType" value="private" />
												</span>
												<span class="ml-2 font-medium">Private</span>
										</Chip>
									</div>
							</li>
							<li v-if="scope == 'private'" class="flex align-items-center py-3 px-2  border-top-1 surface-border flex-wrap">
									<div class="text-tip w-6 md:w-2 font-medium">Users</div>
									<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
										<ChipList icon="pi-user" direction="v" placeholder="Add user" v-model:list="config.users" />
									</div>
							</li>
						</ul>
					</div>
				</TabPanel>
			</TabView>
		</BlockViewer>
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
