<script setup>
import { ref, onMounted, computed,watch } from 'vue';
import ZtmService from '@/service/ZtmService';
import { useRoute } from 'vue-router'
import { useToast } from "primevue/usetoast";
import { isAdmin } from "@/service/common/authority-utils";
import { useStore } from 'vuex';
import _ from "lodash"
import { downloadFile } from '@/utils/file';
import { inAppPay } from '@/utils/pay';
import { platform, isSafariOrMacOS } from '@/utils/platform';
import { copy } from '@/utils/clipboard';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
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
	json:t(`Paste your permit here.`)
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
	&& ((!!liveSample.value) || (
		config.value.agent.certificate.length>0 
		&& config.value.ca.length>0 
		&& config.value.bootstraps.length>0 
		&& !!config.value.bootstraps[0]
		&& !['sample','local','default'].includes((config.value?.name||'').toLocaleLowerCase())
	))
});
const permitType = ref('Json');
const permit = ref('');
const liveSample = ref('');

const joinLive = () => {
	ztmService.identity().then((PublicKey)=>{
		const username = config.value.agent?.name;
		if(!!PublicKey){
			ztmService.getPermit(PublicKey,username,liveSample.value).then((permitJSON)=>{
				if(!!permitJSON){
					let saveData = {
						name: "",
						ca: "",
						agent: {
							name: "",
							certificate: "",
							privateKey: null,
						},
						bootstraps: []
					}
					
					saveData = {...saveData, ...permitJSON};
					saveData.name = config.value.name;
					saveData.agent.name = username
					ztmService.joinMesh(saveData.name, saveData)
					.then(res => {
						loading.value = false;
						if(!!res){
							toast.add({ severity: 'success', summary:'Tips', detail: 'Joined.', life: 3000 });
							emits("save", saveData);
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
			}).catch((e)=>{
				loading.value = false;
			});
		}
	})
}

const commit = () => {
	const joinName = config.value.name;
	const saveData = _.cloneDeep(config.value);
	delete saveData.name;
	loading.value = true;
	if(!!liveSample.value){
		joinLive();
	} else {
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
watch(() => permit.value,() => {
	if(!!permit.value){
		if(permit.value.indexOf("ztm://")==0){
			liveSample.value = permit.value.replace("ztm://","https://");
		} else {
			liveSample.value = ""
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
							downloadFile({
								data: res,
								fileName:`identity`,
								ext: 'txt'
							});
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
const pay = () => {
	inAppPay(()=>{
		console.log(res)
		console.log('Apple Pay initiated');
	})
}
</script>

<template>
	
	<div class="surface-ground h-full" :style="{'minHeight':`calc(100vh)`}">
		<AppHeader :back="back">
				<template #center>
					<b>{{props.title||t('Join Mesh')}}</b>
				</template>
		
				<template #end> 
					<Button :loading="loading" :disabled="!enabled" :label="t('Save')" aria-label="Submit" size="small" @click="commit"/>
				</template>
		</AppHeader>
		<div class="md:m-3 relative h-full min-h-screen">
			<ScrollPanel class="w-full absolute" style="top:0px;bottom: 0;">
			<BlockViewer containerClass="surface-section px-3 md:px-4 md:pb-7 lg:px-5 pt-4" >
			<Loading v-if="loading" />
			<div class="grid" v-else>
				<div class="col-12 md:col-6">
					<div class="surface-section">
						<h6><Tag severity="contrast" value="Contrast">{{t('Names')}}</Tag></h6>
						<ul class="list-none p-0 m-0">
							<FormItem :label="t('Mesh')">
								<Chip class="pl-0 pr-3 mr-2">
										<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
											<i class="pi pi-bookmark"/>
										</span>
										<span class="ml-2 font-medium">
											<InputText :disabled="!!props.pid" :placeholder="t('Name your mesh')" class="add-tag-input xxl" :unstyled="true" v-model="config.name" type="text" />
										</span>
								</Chip>
								<div v-if="config.name.toLocaleLowerCase() == 'sample'" class="text-sm opacity-80 p-1">{{t('Cannot use Sample name')}}</div>
							</FormItem>
							<FormItem :label="t('Join As')">
								<Chip class="pl-0 pr-3 align-items-top"  >
										<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
											<i class="pi pi-user" />
										</span>
										<span class="font-medium ml-2">
											<InputText :maxLength="20" :placeholder="t('Name your endpoint')" class="add-tag-input xxl" :unstyled="true" v-model="config.agent.name" type="text" />
										</span>
								</Chip>	
							</FormItem>
						</ul>
					</div>
				</div>
				<div class="col-12 md:col-6">
					<div class="surface-section">
						<h6 class="flex">
							<Tag severity="contrast" value="Contrast">{{t('Permit')}}</Tag>
						</h6>
						<ul class="list-none p-0 m-0" >
							<li class="flex align-items-center py-3 px-2 surface-border flex-wrap">
									<div class="text-900 w-full">
										<CertificateUploder accept="application/json,text/plain" :placeholder="placeholder.json" v-model="permit" format="json" label="your permit"/>
									</div>
							</li>
						</ul>
						<div class="pl-2" v-if="!permit">
							<i class="pi pi-info-circle relative" style="top: 1px;"/>
							{{t('For non-root users, get your')}} <Button @click="toggleUsermenu" class="p-0" label="<Identity>" link /> {{t("and send it to 'root' user to acquire a permit")}}
						</div>
						
						<div class="pl-2 mt-3" v-if="!permit && platform() == 'ios' && false">
							<div><i class="pi pi-cart-arrow-down relative" style="top: 1px;"/> {{t('Or, you can')}} <Button @click="pay" class="p-0" :label="t('<Buy>')" link /> {{t('an AWS hub and received a root permit')}}</div>
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
