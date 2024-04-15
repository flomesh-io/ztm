<script setup>
import { ref, onMounted, computed } from 'vue';
import PipyProxyService from '@/service/PipyProxyService';
import MeshSelector from './common/MeshSelector.vue'
import { useRoute } from 'vue-router'
import { useToast } from "primevue/usetoast";
import { isAdmin } from "@/service/common/authority-utils";
import store from "@/store";
import _ from "lodash"

const emits = defineEmits(['save']);

const selected = ref(null);
const endpoints = ref([]);
const route = useRoute();
const toast = useToast();
const pipyProxyService = new PipyProxyService();
const loading = ref(false);
const config = ref({
	name: "",
	protocol: "tcp",
	host:'127.0.0.1',
	ep: null,
	port:null
});
const newConfig = () => {
	config.value = {
		name: "",
		protocol: "tcp",
		host:'127.0.0.1',
		ep: null,
		port:null
	}
}

const getEndpoints = () => {
	pipyProxyService.getEndpoints(selected.value?.name)
		.then(res => {
			console.log("Endpoints:")
			console.log(res)
			endpoints.value = res || [];
			if(!!res.find((ep)=> ep.id == selected.value.agent?.id)){
				config.value.ep = selected.value.agent?.id;
			} else {
				config.value.ep = res[0].id;
			}
		})
		.catch(err => console.log('Request Failed', err)); 
}
const enabled = computed(() => {
	return selected.value && config.value.name.length>0 && selected.value && !!selected.value.agent?.id;
});
const select = (d) => {
	selected.value = d;
	getEndpoints();
}
const commit = () => {
	pipyProxyService.createService({
		mesh: selected.value.name,
		ep: config.value.ep,
		name: config.value.name,
		proto: config.value.protocol,
		host: config.value.host,
		port: config.value.port
	})
		.then(res => {
			console.log('commit service:')
			console.log(res)
			if(!!res.name){
				toast.add({ severity: 'success', summary:'Tips', detail: 'Create successfully.', life: 3000 });
				emits("save", config.value);
				newConfig();
			} else{
				toast.add({ severity: 'error', summary:'Tips', detail: 'Create Failed.', life: 3000 });
			}
		})
		.catch(err => {
			console.log('Request Failed', err)
		}); 
}
onMounted(() => {
});
const home = ref({
    icon: 'pi pi-desktop'
});
</script>

<template>
	<div v-if="route.params?.id" style="padding-left: 0px;padding-top: 0;padding-right: 0;m">
		<Breadcrumb :home="home" :model="[{label:route.params?.id}]" />
	</div>
	<div >
		<BlockViewer text="Json" header="Create Service" containerClass="surface-section px-3 py-3 md:px-4 md:py-7 lg:px-5" >
			<template #actions>
				<Button :disabled="!enabled" label="Save" aria-label="Submit" size="small" @click="commit"/>
			</template>
			<div v-if="loading" class="p-4">
			    <div class="flex mb-3">
			        <Skeleton shape="circle" size="4rem" class="mr-2"></Skeleton>
			        <div>
			            <Skeleton width="10rem" class="mb-2"></Skeleton>
			            <Skeleton width="5rem" class="mb-2"></Skeleton>
			            <Skeleton height=".5rem"></Skeleton>
			        </div>
			    </div>
			    <Skeleton width="100%" height="150px"></Skeleton>
			    <div class="flex justify-content-between mt-3">
			        <Skeleton width="4rem" height="2rem"></Skeleton>
			        <Skeleton width="4rem" height="2rem"></Skeleton>
			    </div>
			</div>
			
			<div class="surface-section">
				<ul class="list-none p-0 m-0">
					<li class="flex align-items-center py-3 px-2  border-bottom-1 surface-border flex-wrap">
							<div class="text-500 w-6 md:w-2 font-medium">Service</div>
							<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
								<Chip class="pl-0 pr-3 mr-2">
								    <span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
											<i class="pi pi-bookmark"/>
										</span>
								    <span class="ml-2 font-medium">
											<InputText placeholder="Name" class="add-tag-input xl" :unstyled="true" v-model="config.name" type="text" />
										</span>
								</Chip>
							</div>
					</li>
					<li class="flex align-items-center py-3 px-2  border-bottom-1 surface-border flex-wrap">
							<div class="text-500 w-6 md:w-2 font-medium">Mesh</div>
							<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
								<Chip class="pl-0 pr-3 mr-2">
										<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
											<i class="pi pi-globe"/>
										</span>
										<span class="font-medium">
											<MeshSelector 
												:full="true" 
												innerClass="flex" 
												@select="select"/>
										</span>
								</Chip>
							</div>
					</li>
					<li class="flex align-items-center py-3 px-2  border-bottom-1 surface-border flex-wrap">
							<div class="text-500 w-6 md:w-2 font-medium">Endpoint</div>
							<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
								<Chip class="pl-0 pr-3 mr-2">
										<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
											<i class="pi pi-chart-scatter"/>
										</span>
										<span class="font-medium">
											<Dropdown
													v-model="config.ep" 
													:options="endpoints" 
													optionLabel="name" 
													optionValue="id"
													placeholder="Endpoint" 
													class="flex"></Dropdown>
										</span>
								</Chip>
							</div>
					</li>
					<li class="flex align-items-center py-3 px-2 surface-border flex-wrap border-bottom-1">
							<div class="text-500 w-6 md:w-2 font-medium">Protocol</div>
							<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1 bootstrap">
								<Chip class="pl-0 pr-3">
										<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
											<RadioButton v-model="config.protocol" inputId="scopeType2" name="scopeType" value="tcp" />
										</span>
										<span class="ml-2 font-medium">TCP</span>
								</Chip>
								
								<Chip class="ml-2 pl-0 pr-3">
										<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
											<RadioButton v-model="config.protocol" inputId="scopeType3" name="scopeType" value="udp" />
										</span>
										<span class="ml-2 font-medium">UDP</span>
								</Chip>
							</div>
					</li>
					<li class="flex align-items-center py-3 px-2  border-bottom-1 surface-border flex-wrap">
							<div class="text-500 w-6 md:w-2 font-medium">Host</div>
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
							<div class="text-500 w-6 md:w-2 font-medium">Port</div>
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
