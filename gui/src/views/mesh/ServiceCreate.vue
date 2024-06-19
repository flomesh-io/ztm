<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import PipyProxyService from '@/service/PipyProxyService';
import MeshSelector from './common/MeshSelector.vue'
import { useRoute } from 'vue-router'
import { useToast } from "primevue/usetoast";
import { isAdmin } from "@/service/common/authority-utils";
import { useStore } from 'vuex';
import _ from "lodash"

const props = defineProps(['embed','pid','mesh','ep','proto','title']);
const emits = defineEmits(['save','back']);
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
			endpoints.value.forEach((ep)=>{
				ep.label = ep.name || ep.username || 'Unknow EP'
			})
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
const active = ref(0);

const back = () => {
	emits('back')
}
const windowWidth = computed(() =>  window.innerWidth);
const isMobile = computed(() => windowWidth.value<=768);
</script>

<template>

	<div class="surface-ground" :style="{'minHeight':`calc(100vh - ${props.embed?'100px':'20px'})`}">
		<AppHeader :back="back">
				<template #center>
					<b>{{props.title||'Create Service'}}</b>
				</template>
		
				<template #end> 
					<Button :loading="loading" :disabled="!enabled" label="Save" aria-label="Submit" size="small" @click="commit"/>
				</template>
		</AppHeader>
		<div class="md:m-3">
		<BlockViewer containerClass="surface-section px-1 md:px-1 md:pb-7 lg:px-1" >
			<Loading v-if="loading" />
			<TabView v-else :class="{'tabview-vertical':!isMobile}" v-model:activeIndex="active">
				<TabPanel>
					<template #header><i class="pi pi-cog mr-2"/>Config</template>
					<div>
						<ul class="list-none p-0 m-0">
							<FormItem label="Service">
								<Chip class="pl-0 pr-3 mr-2">
										<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
											<i class="pi pi-bookmark"/>
										</span>
										<span class="ml-2 font-medium">
											<InputText :disabled="!!props.pid" placeholder="Name your service" class="add-tag-input xxl" :unstyled="true" v-model="config.name" type="text" />
										</span>
								</Chip>
							</FormItem>
							<FormItem label="Mesh">
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
							</FormItem>
							<FormItem label="Endpoint">
								<Chip class="pl-0 pr-3 mr-2">
										<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
											<i class="pi pi-chart-scatter"/>
										</span>
										<span class="font-medium">
											<Select
											 :disabled="!!props.pid"
												v-model="config.ep" 
												:options="endpoints" 
												optionLabel="label" 
												optionValue="id"
												placeholder="Endpoint" 
												class="flex"></Select>
										</span>
								</Chip>
							</FormItem>
							<FormItem label="Protocol">
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
							</FormItem>
							<FormItem label="Host">
								<Chip class="pl-0 pr-3 mr-2">
										<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
											<i class="pi pi-bookmark"/>
										</span>
										<span class="ml-2 font-medium">
											<InputText placeholder="Name" class="add-tag-input xl" :unstyled="true" v-model="config.host" type="text" />
										</span>
								</Chip>
							</FormItem>
							<FormItem label="Port" :border="false">
								<Chip class="pl-0 pr-3 mr-2">
										<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
											<i class="pi pi-sort"/>
										</span>
										<span class="ml-2 font-medium">
											<InputNumber :useGrouping="false" :min="1" :max="65535" placeholder="1-65535" class="add-tag-input" :unstyled="true" v-model="config.port" type="text" />
										</span>
								</Chip>
							</FormItem>
						</ul>
					</div>
				</TabPanel>
				<TabPanel>
					<template #header><i class="pi pi-shield mr-2"/>Security</template>
					<div class="surface-section" >
						<ul class="list-none p-0 m-0">
							<FormItem label="Scope" :border="scope == 'private'">
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
							</FormItem>
							<FormItem v-if="scope == 'private'" label="Users" :border="false">
								<ChipList icon="pi-user" direction="v" placeholder="Add user" v-model:list="config.users" />
							</FormItem>
						</ul>
					</div>
				</TabPanel>
			</TabView>
			</BlockViewer>
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
