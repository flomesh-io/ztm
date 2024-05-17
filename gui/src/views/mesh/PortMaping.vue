<script setup>
import { ref, onActivated, computed } from 'vue';
import PipyProxyService from '@/service/PipyProxyService';
import { useRoute } from 'vue-router'
import { useToast } from "primevue/usetoast";
import { isAdmin } from "@/service/common/authority-utils";
import { useStore } from 'vuex';
const store = useStore();
import _ from "lodash"

const emits = defineEmits(['save']);
const props = defineProps({
    mesh: {
			type: String,
			default: ''
    },
    proto: {
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
    targetEndpoints: {
			type: Array,
			default: () => []
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
	protocol: props.proto,
	ep: props.endpoint,
	listen: {
		ip:'127.0.0.1',
		port:null,
	},
	target: {
		endpoint: props.targetEndpoint?.id || 0,
		service: props.service,
	}
});
const newConfig = () => {
	config.value = {
		protocol: props.proto,
		ep: props.endpoint,
		listen: {
			ip:'127.0.0.1',
			port:null,
		},
		target: {
			endpoint: props.targetEndpoint?.id || 0,
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
		ep: config.value.ep,
		proto: config.value.protocol,
		ip: config.value.listen?.ip,
		port: config.value.listen?.port,
		body: { target }
	};
	console.log('commit port:')
	console.log(d)
	loading.value = true;
	pipyProxyService.createPort(d)
		.then(res => {
			loading.value = false;
			console.log(res)
			if(!!res){
				toast.add({ severity: 'success', summary:'Tips', detail: 'Create successfully.', life: 3000 });
				emits("save", config.value);
				newConfig();
			}
		})
		.catch(err => {
			loading.value = false;
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
		<BlockViewer text="Json" header="Connect" containerClass="surface-section px-3 py-3 md:px-4 lg:px-5" >
			<template #actions>
				<Button class="mr-2" label="Cancel" size="small" link @click="cancel"/>
				<Button :loading="loading" :disabled="!enabled" label="Save" aria-label="Submit" size="small" @click="commit"/>
			</template>
			
			<Loading v-if="loading" />
			<div v-else class="surface-section">
				<ul class="list-none p-0 m-0">
					<li class="flex align-items-center py-3 px-2  border-bottom-1 surface-border flex-wrap">
							<div class="text-500 w-8rem font-medium">Mesh</div>
							<div class="text-900 flex-item">
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
					<li class="flex align-items-center py-3 px-2 surface-border flex-wrap border-bottom-1">
							<div class="text-500 w-8rem font-medium">Protocol</div>
							<div class="text-900 flex-item">
								<Chip class="pl-0 pr-3" v-if="config.protocol == 'tcp'">
										<span class=" border-circle w-2rem h-2rem flex align-items-center justify-content-center">
											<RadioButton v-model="config.protocol" inputId="scopeType2" name="scopeType" value="tcp" />
										</span>
										<span class="ml-2 font-medium">TCP</span>
								</Chip>
								
								<Chip class="pl-0 pr-3" v-if="config.protocol == 'udp'">
										<span class=" border-circle w-2rem h-2rem flex align-items-center justify-content-center">
											<RadioButton v-model="config.protocol" inputId="scopeType3" name="scopeType" value="udp" />
										</span>
										<span class="ml-2 font-medium">UDP</span>
								</Chip>
							</div>
					</li>
					<li class="pt-6">
						<div class="grid">
							<div class="col-12 md:col-6">
								<div class="surface-section">
									<h6><Tag severity="contrast" value="Contrast">From</Tag></h6>
									<ul class="list-none p-0 m-0">
										
										<li class="flex align-items-center py-3 px-2  border-bottom-1 surface-border flex-wrap">
												<div class="text-500 w-8rem font-medium">Endpoint</div>
												<div class="text-900 flex-item">
													<Chip class="pl-0 pr-3 mr-2">
															<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
																<i class="pi pi-chart-scatter"/>
															</span>
															<span class="font-medium">
																<Select
																		style="max-width: 200px;"
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
										<li class="flex align-items-center py-3 px-2  border-bottom-1 surface-border flex-wrap">
												<div class="text-500 w-8rem font-medium">IP</div>
												<div class="text-900 flex-item">
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
												<div class="text-500 w-8rem font-medium">Port</div>
												<div class="text-900 flex-item">
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
							</div>
							<div class="col-12 md:col-6">
								<div class="surface-section">
									<h6><Tag severity="contrast" value="Contrast">To</Tag></h6>
									<ul class="list-none p-0 m-0">
										<li v-if="!!targetEndpoint?.id" class="flex align-items-center py-3 px-2  border-bottom-1 surface-border flex-wrap">
												<div class="text-500 w-8rem font-medium">Endpoint</div>
												<div class="text-900 flex-item">
													<Chip class="pl-0 pr-3 mr-2">
															<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
																<i class="pi pi-chart-scatter"/>
															</span>
															<span v-tooltip="targetEndpoint?.name || targetEndpoint?.id" class="ml-2 font-medium text-ellipsis" style="max-width: 200px;">
																{{targetEndpoint?.name || targetEndpoint?.id}}
															</span>
													</Chip>
												</div>
										</li>
										<li v-else class="flex align-items-center py-3 px-2 border-bottom-1 surface-border flex-wrap">
												<div class="text-500 w-8rem font-medium">Endpoint</div>
												<div class="text-900 flex-item">
													<Chip class="pl-0 pr-3 mr-2">
															<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
																<i class="pi pi-chart-scatter"/>
															</span>
															<span class="font-medium">
																<Select
																		v-model="config.target.endpoint" 
																		:options="[{name:'Any', id:0}].concat(targetEndpoints)" 
																		optionLabel="name" 
																		optionValue="id"
																		placeholder="Endpoint" 
																		style="max-width: 200px;"
																		class="flex small"></Select>
															</span>
													</Chip>
												</div>
										</li>
										<li class="flex align-items-center py-3 px-2   surface-border flex-wrap">
												<div class="text-500 w-8rem font-medium">Service</div>
												<div class="text-900 flex-item">
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
									</ul>
								</div>
							</div>
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
