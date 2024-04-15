<script setup>
import { ref, onActivated, computed } from 'vue';
import PipyProxyService from '@/service/PipyProxyService';
import { useRoute } from 'vue-router'
import { useToast } from "primevue/usetoast";
import { isAdmin } from "@/service/common/authority-utils";
import store from "@/store";
import _ from "lodash"

const emits = defineEmits(['save']);
const props = defineProps({
    mesh: {
			type: String,
			default: ''
    },
    endpoint: {
			type: String,
			default: ''
    },
    targetEndpoint: {
			type: Object,
			default: () => {}
    },
    endpoints: {
			type: Array,
			default: () => []
    },
    service: {
			type: String,
			default: ''
    },
    servicePort: {
			type: Number,
			default: 0
    },
});
const route = useRoute();
const toast = useToast();
const pipyProxyService = new PipyProxyService();
const loading = ref(false);
const config = ref({
	protocol: "tcp",
	listen: {
		ip:'127.0.0.1',
		port:props.servicePort,
	},
	target: {
		endpoint: props.targetEndpoint?.id,
		service: props.service,
	}
});
const newConfig = () => {
	config.value = {
		protocol: "tcp",
		listen: {
			ip:'127.0.0.1',
			port:props.servicePort,
		},
		target: {
			endpoint: props.targetEndpoint?.id,
			service: props.service,
		}
	}
}

onActivated(() => {
	newConfig();
});
const enabled = computed(() => {
	return config.value.listen?.port>0 && !!config.value.listen?.ip;
});
const commit = () => {
	const target = _.cloneDeep(config.value.target);
	if(!target.endpoint){
		delete target.endpoint;
	}
	const d = {
		mesh: props.mesh,
		ep: props.endpoint,
		proto: config.value.protocol,
		ip: config.value.listen?.ip,
		port: config.value.listen?.port,
		body: { target }
	};
	console.log('commit port:')
	console.log(d)
	pipyProxyService.createPort(d)
		.then(res => {
			console.log(res)
			if(!!res.listen){
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

const cancel = () => {
	newConfig();
	emits("save", false);
}
const home = ref({
    icon: 'pi pi-desktop'
});
</script>

<template>
	<div >
		<BlockViewer text="Json" header="Map to Local Port" containerClass="surface-section px-3 py-3 md:px-4 lg:px-5" >
			<template #actions>
				<Button class="mr-2" label="Cancel" size="small" link @click="cancel"/>
				<Button :disabled="!enabled" label="Save" aria-label="Submit" size="small" @click="commit"/>
			</template>
			
			<div class="surface-section">
				<ul class="list-none p-0 m-0">
					<li class="flex align-items-center py-3 px-2  border-bottom-1 surface-border flex-wrap">
							<div class="text-500 w-6 md:w-2 font-medium">Mesh</div>
							<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
								<Chip class="pl-0 pr-3 mr-2">
										<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
											<i class="pi pi-globe"/>
										</span>
										<span class="font-medium ml-2">
											{{decodeURI(props.mesh)}}
										</span>
								</Chip>
							</div>
					</li>
					<li class="flex align-items-center py-3 px-2  border-bottom-1 surface-border flex-wrap">
							<div class="text-500 w-6 md:w-2 font-medium">Service</div>
							<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
								<Chip class="pl-0 pr-3 mr-2">
								    <span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
											<i class="pi pi-bookmark"/>
										</span>
								    <span class="ml-2 font-medium">
											{{config.target?.service}}
										</span>
								</Chip>
							</div>
					</li>
					<li v-if="!!targetEndpoint?.id" class="flex align-items-center py-3 px-2  border-bottom-1 surface-border flex-wrap">
							<div class="text-500 w-6 md:w-2 font-medium">Endpoint</div>
							<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
								<Chip class="pl-0 pr-3 mr-2">
								    <span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
											<i class="pi pi-chart-scatter"/>
										</span>
								    <span class="ml-2 font-medium">
											{{targetEndpoint?.name || targetEndpoint?.id}}
										</span>
								</Chip>
							</div>
					</li>
					<li v-else class="flex align-items-center py-3 px-2  border-bottom-1 surface-border flex-wrap">
							<div class="text-500 w-6 md:w-2 font-medium">Endpoint</div>
							<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
								<Chip class="pl-0 pr-3 mr-2">
										<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
											<i class="pi pi-chart-scatter"/>
										</span>
										<span class="font-medium">
											<Dropdown
													v-model="config.target.endpoint" 
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
							<div class="text-500 w-6 md:w-2 font-medium">IP</div>
							<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
								<Chip class="pl-0 pr-3 mr-2">
								    <span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
											<i class="pi pi-bookmark"/>
										</span>
								    <span class="ml-2 font-medium">
											<InputText placeholder="Name" class="add-tag-input xl" :unstyled="true" v-model="config.listen.ip" type="text" />
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
											<InputNumber :useGrouping="false" :min="1" :max="65535" placeholder="1-65535" class="add-tag-input" :unstyled="true" v-model="config.listen.port" type="text" />
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
