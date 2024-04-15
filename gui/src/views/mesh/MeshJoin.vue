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
const config = ref({
	name: "",
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
	&& config.value.agent.privateKey.length>0 
	&& config.value.bootstraps.length>0;
});
const commit = () => {
	const joinName = config.value.name;
	const saveData = _.cloneDeep(config.value)
	delete saveData.name;
	pipyProxyService.joinMesh(joinName, saveData)
		.then(res => {
			if(!!res.name){
				toast.add({ severity: 'success', summary:'Tips', detail: 'Joined.', life: 3000 });
				emits("save", config.value);
				newConfig();
			} else{
				toast.add({ severity: 'error', summary:'Tips', detail: 'Join Failed.', life: 3000 });
			}
		})
		.catch(err => console.log('Request Failed', err)); 
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
							<div class="text-500 w-6 md:w-2 font-medium">Mesh</div>
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
					<li class="flex align-items-center py-3 px-2 border-bottom-1 surface-border flex-wrap">
							<div class="text-500 w-6 md:w-2 font-medium">Join As</div>
							<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
								<Chip class="pl-0 pr-3 mb-2 align-items-top"  >
										<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
											<i class="pi pi-user" />
										</span>
										<span class="font-medium ml-2">
											<InputText :maxLength="20" placeholder="Name" class="add-tag-input xxl" :unstyled="true" v-model="config.agent.name" type="text" />
										</span>
								</Chip>	
							</div>
					</li>
					<li class="flex align-items-center py-3 px-2 border-bottom-1 surface-border flex-wrap">
							<div class="text-500 w-6 md:w-2 font-medium">Hubs</div>
							<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1 bootstrap">
								<ChipList icon="pi-desktop" placeholder="Host:Port" v-model:list="config.bootstraps" />
							</div>
					</li>
					
					<li class="flex align-items-center py-3 px-2 border-bottom-1 surface-border flex-wrap">
							<div class="text-500 w-6 md:w-2 font-medium">Certificate</div>
							<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
								<Chip class="pl-0 pr-3 mb-2 align-items-top teatarea-panel"  >
										<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
											<i class="pi pi-shield" />
										</span>
										<span class="font-medium">
											<Textarea  placeholder="Unset" v-model="config.agent.certificate" :autoResize="false" rows="8" />
										</span>
								</Chip>	
							</div>
					</li>
					<li class="flex align-items-center py-3 px-2  surface-border flex-wrap">
							<div class="text-500 w-6 md:w-2 font-medium">Private Key</div>
							<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
								
								<Chip class="pl-0 pr-3 mb-2 align-items-top teatarea-panel">
										<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
											<i class="pi pi-key" />
										</span>
										<span class="font-medium">
											<Textarea placeholder="Unset" v-model="config.agent.privateKey" :autoResize="false" rows="5"  />
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
