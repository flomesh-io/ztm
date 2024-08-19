<script setup>
import { ref, onMounted, computed,watch } from 'vue';
import ZtmService from '@/service/ZtmService';
import { useRoute } from 'vue-router'
import { useToast } from "primevue/usetoast";
import { isAdmin } from "@/service/common/authority-utils";
import { useStore } from 'vuex';
import _ from "lodash"
import exportFromJSON from 'export-from-json';
import { copy } from '@/utils/clipboard';
const store = useStore();
const props = defineProps(['pid','title']);
const emits = defineEmits(['save','back']);
const route = useRoute();
const toast = useToast();
const ztmService = new ZtmService();
const user = computed(() => {
	return store.getters['account/user'];
});
const loading = ref(false);

const placeholder = ref({
	c:`-----BEGIN CERTIFICATE-----`,
	ca:`-----BEGIN CERTIFICATE-----`,
	p:`-----BEGIN RSA PRIVATE KEY-----`,
	json:`Paste JSON here.`
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
	ztmService.joinMesh(joinName, saveData)
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
	ztmService.getMesh(props.pid)
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
const permitType = ref('Json');
const permit = ref('');
watch(() => permit.value,() => {
	if(!!permit.value){
		try{
			const permitJSON = JSON.parse(permit.value);
			const agent_name = config.value?.agent?.name;
			config.value = {...config.value, ...permitJSON};
			if(!config.value?.agent?.name){
				config.value.agent.name = agent_name;
			}
			console.log(config.value)
		}catch(e){
		}
	}
})

const back = () => {
	emits('back')
}

const usermenu = ref();
const usermenuitems = ref([
	{
			label: 'Copy Identity',
			icon: 'pi pi-copy',
			command(){
				ztmService.identity()
					.then(res => {
						if(!!res){
							copy(res)
						}
					})
					.catch(err => {
						loading.value = false;
						console.log('Request Failed', err)
					}); 
			},
	},
	{
			label: 'Download Identity',
			icon: 'pi pi-download',
			command(){
				ztmService.identity()
					.then(res => {
						if(!!res){
							if(!window.__TAURI_INTERNALS__){
								exportFromJSON({ 
									data: res,
									fileName:`identity`,
									exportType: exportFromJSON.types.txt
								})
							} else {
								copy(res)
							}
						}
					})
					.catch(err => {
						loading.value = false;
						console.log('Request Failed', err)
					}); 
			},
	},
]);

const toggleUsermenu = (event) => {
    usermenu.value.toggle(event);
};
const windowWidth = computed(() =>  window.innerWidth);
const isMobile = computed(() => windowWidth.value<=768);
</script>

<template>
	
	<div class="surface-ground h-full" :style="{'minHeight':`calc(100vh - 20px)`}">
		<AppHeader :back="back">
				<template #center>
					<b>{{props.title||'Join Mesh'}}</b>
				</template>
		
				<template #end> 
					<Button :loading="loading" :disabled="!enabled" label="Save" aria-label="Submit" size="small" @click="commit"/>
				</template>
		</AppHeader>
		<div class="md:m-3 relative h-full">
			<ScrollPanel class="w-full absolute" style="top:0px;bottom: 0;">
			<BlockViewer containerClass="surface-section px-3 md:px-4 md:pb-7 lg:px-5 pt-4" >
			<Loading v-if="loading" />
			<div class="grid" v-else>
				<div class="col-12 md:col-6">
					<div class="surface-section">
						<h6><Tag severity="contrast" value="Contrast">Names</Tag></h6>
						<ul class="list-none p-0 m-0">
							<FormItem label="Mesh">
								<Chip class="pl-0 pr-3 mr-2">
										<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
											<i class="pi pi-bookmark"/>
										</span>
										<span class="ml-2 font-medium">
											<InputText :disabled="!!props.pid" placeholder="Name your mesh" class="add-tag-input xxl" :unstyled="true" v-model="config.name" type="text" />
										</span>
								</Chip>
							</FormItem>
							<FormItem label="Join As">
								<Chip class="pl-0 pr-3 align-items-top"  >
										<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
											<i class="pi pi-user" />
										</span>
										<span class="font-medium ml-2">
											<InputText :maxLength="20" placeholder="Name your endpoint" class="add-tag-input xxl" :unstyled="true" v-model="config.agent.name" type="text" />
										</span>
								</Chip>	
							</FormItem>
						</ul>
					</div>
				</div>
				<div class="col-12 md:col-6">
					<div class="surface-section">
						<h6 class="flex">
							<Tag severity="contrast" value="Contrast">Permit</Tag>
						</h6>
						<ul class="list-none p-0 m-0" >
							<li class="flex align-items-center py-3 px-2 surface-border flex-wrap">
									<div class="text-900 w-full">
										<CertificateUploder :placeholder="placeholder.json" v-model="permit" format="json" label="your permit"/>
									</div>
							</li>
						</ul>
						<div class="text-center" >
							<i class="pi pi-info-circle relative" style="top: 3px;"/>
							get your <Button @click="toggleUsermenu" class="p-0" label="<Identity>" link /> to root user
						</div>
					</div>
				</div>
			</div>
			</BlockViewer>
			</ScrollPanel>
		</div>
	</div>
	
	<Menu ref="usermenu" id="user_menu" :model="usermenuitems" :popup="true" />
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
