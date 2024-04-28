<script setup>
import { ref, onMounted, computed } from 'vue';
import PipyProxyService from '@/service/PipyProxyService';
import { useRoute } from 'vue-router'
import { useToast } from "primevue/usetoast";
import { isAdmin } from "@/service/common/authority-utils";
import store from "@/store";
import _ from "lodash"

const emits = defineEmits(['save']);
const route = useRoute();
const toast = useToast();
const pipyProxyService = new PipyProxyService();
const user = computed(() => {
	return store.getters['account/user'];
});
const loading = ref(false);

const placeholder = ref({
	c:`-----BEGIN CERTIFICATE-----`,
	ca:`-----BEGIN CERTIFICATE-----`,
	p:`-----BEGIN RSA PRIVATE KEY-----`
})
const config = ref({
	name: "",
	ca: "",
	agent: {
		name: user.value.id,
		certificate: "",
		privateKey: "",
	},
	bootstraps: []
});
const newConfig = () => {
	config.value = {
		name: "",
		ca: "",
		agent: {
			name: user.value.id,
			certificate: "",
			privateKey: "",
		},
		bootstraps: []
	}
}

const enabled = computed(() => {
	return config.value.name.length>0 
	&& config.value.agent.certificate.length>0 
	&& config.value.ca.length>0 
	&& config.value.agent.privateKey.length>0 
	&& config.value.bootstraps.length>0;
});
const commit = () => {
	const joinName = config.value.name;
	const saveData = _.cloneDeep(config.value)
	delete saveData.name;
	loading.value = true;
	pipyProxyService.joinMesh(joinName, saveData)
		.then(res => {
			loading.value = false;
			if(!!res.name){
				toast.add({ severity: 'success', summary:'Tips', detail: 'Joined.', life: 3000 });
				emits("save", config.value);
				newConfig();
			} else{
				toast.add({ severity: 'error', summary:'Tips', detail: 'Join Failed.', life: 3000 });
			}
		})
		.catch(err => {
			loading.value = false;
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
		<BlockViewer text="Json" header="Join Mesh" containerClass="surface-section px-3 py-3 md:px-4 md:py-7 lg:px-5" >
			<template #actions>
				<Button :loading="loading" :disabled="!enabled" label="Save" aria-label="Submit" size="small" @click="commit"/>
			</template>
			<Loading v-if="loading" />
			<div class="grid" v-else>
				<div class="col-12 md:col-6">
					<div class="surface-section">
						<h6><Tag severity="contrast" value="Contrast">Mesh</Tag></h6>
						<ul class="list-none p-0 m-0">
							<li class="flex align-items-center py-3 px-2  surface-border flex-wrap">
									<div class="text-500 w-6 md:w-2 font-medium">Name</div>
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
							<li class="flex align-items-center py-3 px-2 border-top-1 surface-border flex-wrap">
									<div class="text-500 w-6 md:w-2 font-medium">CA Certificate</div>
									<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
										<Chip class="pl-0 pr-3 mb-2 align-items-top teatarea-panel"  >
												<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<i class="pi pi-shield" />
												</span>
												<span class="font-medium">
													<Textarea :placeholder="placeholder.ca" v-model="config.ca" :autoResize="false" rows="8" />
												</span>
										</Chip>	
									</div>
							</li>
							<li class="flex align-items-center py-3 px-2 border-top-1 surface-border flex-wrap">
									<div class="text-500 w-6 md:w-2 font-medium">Hubs</div>
									<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1 bootstrap">
										<ChipList icon="pi-desktop" placeholder="Host:Port" v-model:list="config.bootstraps" />
									</div>
							</li>
							
						</ul>
					</div>
				</div>
				<div class="col-12 md:col-6">
					<div class="surface-section">
						<h6><Tag severity="contrast" value="Contrast">Join As</Tag></h6>
						<ul class="list-none p-0 m-0">
							<li class="flex align-items-center py-3 px-2 surface-border flex-wrap">
									<div class="text-500 w-6 md:w-2 font-medium">Name</div>
									<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
										<Chip class="pl-0 pr-3 align-items-top"  >
												<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<i class="pi pi-user" />
												</span>
												<span class="font-medium ml-2">
													<InputText :maxLength="20" placeholder="Name" class="add-tag-input xxl" :unstyled="true" v-model="config.agent.name" type="text" />
												</span>
										</Chip>	
									</div>
							</li>
							
							<li class="flex align-items-center py-3 px-2 border-top-1 surface-border flex-wrap">
									<div class="text-500 w-6 md:w-2 font-medium">Certificate</div>
									<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
										<Chip class="pl-0 pr-3 mb-2 align-items-top teatarea-panel"  >
												<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<i class="pi pi-shield" />
												</span>
												<span class="font-medium">
													<Textarea :placeholder="placeholder.c" v-model="config.agent.certificate" :autoResize="false" rows="8" />
												</span>
										</Chip>	
									</div>
							</li>
							<li class="flex align-items-center py-3 px-2 border-top-1 surface-border flex-wrap">
									<div class="text-500 w-6 md:w-2 font-medium">Private Key</div>
									<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
										
										<Chip class="pl-0 pr-3 mb-2 align-items-top teatarea-panel">
												<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<i class="pi pi-key" />
												</span>
												<span class="font-medium">
													<Textarea :placeholder="placeholder.p" v-model="config.agent.privateKey" :autoResize="false" rows="5"  />
												</span>
										</Chip>
									</div>
							</li>
							
						</ul>
					</div>
				</div>
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
