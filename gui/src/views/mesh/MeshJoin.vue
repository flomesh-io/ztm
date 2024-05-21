<script setup>
import { ref, onMounted, computed,watch } from 'vue';
import PipyProxyService from '@/service/PipyProxyService';
import { useRoute } from 'vue-router'
import { useToast } from "primevue/usetoast";
import { isAdmin } from "@/service/common/authority-utils";
import { useStore } from 'vuex';
const store = useStore();
import _ from "lodash"
const props = defineProps(['pid','title']);
const emits = defineEmits(['save','cancel']);
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
	p:`-----BEGIN RSA PRIVATE KEY-----`,
	json:`-----BEGIN PERMIT JSON-----`
})

const newConfig = {
	name: "",
	ca: "",
	agent: {
		name: "",
		certificate: "",
		privateKey: null,
	},
	bootstraps: []
}
const config = ref(_.cloneDeep(newConfig));

const enabled = computed(() => {
	return !!config.value?.name>0 
	&& !!config.value.agent?.name>0 
	&& config.value.agent.certificate.length>0 
	&& config.value.ca.length>0 
	&& config.value.agent?.privateKey?.length>0 
	&& config.value.bootstraps.length>0 
	&& !!config.value.bootstraps[0];
});
const commit = () => {
	const joinName = config.value.name;
	const saveData = _.cloneDeep(config.value);
	delete saveData.name;
	loading.value = true;
	pipyProxyService.joinMesh(joinName, saveData)
		.then(res => {
			loading.value = false;
			if(!!res){
				toast.add({ severity: 'success', summary:'Tips', detail: 'Joined.', life: 3000 });
				emits("save", config.value);
				config.value = _.cloneDeep(newConfig);
				config.value.agent.name = user.value.id;
			}
			store.dispatch('account/meshes');
		})
		.catch(err => {
			loading.value = false;
			console.log('Request Failed', err)
		}); 
}
onMounted(() => {
	if(!!props.pid){
		permitType.value = "Form";
		loaddata()
	} else {
		config.value = _.cloneDeep(newConfig);
		config.value.agent.name = user.value.id;
	}
});
const home = ref({
    icon: 'pi pi-desktop'
});

const loaddata = () => {
	loading.value = true;
	pipyProxyService.getMesh(props.pid)
		.then(res => {
			console.log(res);
			loading.value = false;
			config.value = res;
			if(!config.value.agent?.privateKey){
				config.value.agent.privateKey = '';
			}
		})
		.catch(err => {
			loading.value = false;
		}); 
}
const cancel = () => {
	emits("cancel");
}
const permitType = ref('Json');
const permit = ref('');
watch(() => permit.value,() => {
	if(!!permit.value){
		try{
			const permitJSON = JSON.parse(permit.value);
			config.value = {...config.value, ...permitJSON};
			console.log(config.value)
		}catch(e){
		}
	}
})
</script>

<template>
	<div v-if="route.params?.id" style="padding-left: 0px;padding-top: 0;padding-right: 0;m">
		<Breadcrumb :home="home" :model="[{label:route.params?.id}]" />
	</div>
	<div >
		<BlockViewer text="Json" :header="props.title||'Join Mesh'" containerClass="surface-section px-3 py-3 md:px-4 md:pb-7 lg:px-5" >
			<template #actions>
				<Button class="mr-2" severity="secondary" v-if="!!props.pid" label="Cancel" size="small" @click="cancel"/>
				<Button :loading="loading" :disabled="!enabled" label="Save" aria-label="Submit" size="small" @click="commit"/>
			</template>
			<Loading v-if="loading" />
			<div class="grid" v-else>
				<div class="col-12 md:col-6">
					<div class="surface-section">
						<h6><Tag severity="contrast" value="Contrast">Names</Tag></h6>
						<ul class="list-none p-0 m-0">
							<li class="flex align-items-center py-3 px-2  surface-border flex-wrap">
									<div class="text-tip w-6 md:w-2 font-medium">Mesh</div>
									<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
										<Chip class="pl-0 pr-3 mr-2">
												<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<i class="pi pi-bookmark"/>
												</span>
												<span class="ml-2 font-medium">
													<InputText :disabled="!!props.pid" placeholder="Unset" class="add-tag-input xl" :unstyled="true" v-model="config.name" type="text" />
												</span>
										</Chip>
									</div>
							</li>
							<li class="flex align-items-center border-top-1 py-3 px-2 surface-border flex-wrap">
									<div class="text-tip w-6 md:w-2 font-medium">Join As</div>
									<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
										<Chip class="pl-0 pr-3 align-items-top"  >
												<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<i class="pi pi-user" />
												</span>
												<span class="font-medium ml-2">
													<InputText :maxLength="20" placeholder="Unset" class="add-tag-input xxl" :unstyled="true" v-model="config.agent.name" type="text" />
												</span>
										</Chip>	
									</div>
							</li>
							
						</ul>
					</div>
				</div>
				<div class="col-12 md:col-6">
					<div class="surface-section">
						<h6 class="flex">
							<Tag severity="contrast" value="Contrast">Permit</Tag>
							<div class="flex flex-wrap gap-3 ml-8">
							    <div class="flex align-items-center">
							        <RadioButton v-model="permitType" inputId="ingredient1" name="pizza" value="Json" />
							        <label for="ingredient1" class="ml-2 text-tip">JSON</label>
							    </div>
							    <div class="flex align-items-center">
							        <RadioButton v-model="permitType" inputId="ingredient2" name="pizza" value="Form" />
							        <label for="ingredient2" class="ml-2 text-tip">Form</label>
							    </div>
							</div>
						</h6>
						<ul class="list-none p-0 m-0" v-if="permitType == 'Json'">
							<li class="flex align-items-center py-3 px-2 surface-border flex-wrap">
									<div class="text-tip w-6 md:w-2 font-medium">JSON</div>
									<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
										<CertificateUploder :placeholder="placeholder.json" v-model="permit" format="json" label="[permit.json]"/>
									</div>
							</li>
						</ul>
						<ul class="list-none p-0 m-0" v-else>
							
							<li class="flex align-items-center py-3 px-2 surface-border flex-wrap">
									<div class="text-tip w-6 md:w-2 pr-2 font-medium">Hubs</div>
									<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1 bootstrap">
										<ChipList icon="pi-desktop" placeholder="Host:Port" v-model:list="config.bootstraps" />
									</div>
							</li>
							<li class="flex align-items-center py-3 px-2 border-top-1 surface-border flex-wrap">
									<div class="text-tip w-6 md:w-2 pr-2 font-medium">CA Certificate</div>
									<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
										<CertificateUploder :placeholder="placeholder.ca" v-model="config.ca"/>
									</div>
							</li>
							<li class="flex align-items-center py-3 px-2 border-top-1 surface-border flex-wrap">
									<div class="text-tip w-6 md:w-2 pr-2 font-medium">Certificate</div>
									<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
										<CertificateUploder :placeholder="placeholder.c" v-model="config.agent.certificate"/>
									</div>
							</li>
							<li class="flex align-items-center pr-2 py-3 px-2 border-top-1 surface-border flex-wrap">
									<div class="text-tip w-6 md:w-2 font-medium">Private Key</div>
									<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
										<CertificateUploder :placeholder="placeholder.p" v-model="config.agent.privateKey"/>
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
