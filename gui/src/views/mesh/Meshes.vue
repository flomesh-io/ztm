<script setup>
import { ref, onMounted,computed,watch } from "vue";
import { useRouter } from 'vue-router'
import ZtmService from '@/service/ZtmService';
import MeshJoin from './MeshJoin.vue';
import { useConfirm } from "primevue/useconfirm";
import { useStore } from 'vuex';
import { useToast } from "primevue/usetoast";
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
const store = useStore();
const router = useRouter();
const confirm = useConfirm();
const ztmService = new ZtmService();
const toast = useToast();
const meshes = computed(() => {
	return store.getters['account/meshes'] || []
});
const status = ref({});
const scopeType = ref('All');

const platform = computed(() => {
	return store.getters['account/platform']
});
const loading = ref(false);
const loader = ref(false);

const deleteMesh = () => {
	const name = selectMesh.value?.name;
	if(!name){
		return
	}
	ztmService.deleteMesh(name,() => {
		setTimeout(()=>{
			store.dispatch('account/meshes');
		},1000);
		selectedMenu.value = null;
		visibleEditor.value = false;
	});
	
}
const changeStatus = (mesh,val) => {
	status.value[`${mesh.host}:${mesh.port}`] = val;
}
const join = () => {
	visibleEditor.value = false;
	setTimeout(()=>{
		store.dispatch('account/meshes');
	},1000);
	selectedMenu.value = null;
	visibleEditor.value = false;
}

const visibleEditor = ref(false);
const selectedMenu = ref();
const actionMenu = ref();
const editMesh = ()=> {
	selectedMenu.value = selectMesh.value;
	visibleEditor.value = true;
}
const selectMesh = ref()
const showAtionMenu = (event, mesh) => {
	actionMenu.value[0].toggle(event);
	selectMesh.value = mesh;
};

const emptyMsg = computed(()=>{
	return t(`You haven't joined a mesh yet.`)
});

const hasPubHub = computed(()=>{
	return !!ztmService.getPubHub()
});

const selectedMesh = computed(() => {
	return store.getters["account/selectedMesh"]
});
const select = (mesh) => {
	store.commit('account/setSelectedMesh', mesh);
}
const loaddata = () => {
	store.dispatch('account/meshes');
}
const visibleTry = ref(false);
const username = ref("");
const tryLoading = ref(false);
const tryMesh = () => {
	ztmService.identity().then((PublicKey)=>{
		if(!!PublicKey){
			tryLoading.value = true;
			ztmService.getPermit(PublicKey,username.value).then((permitJSON)=>{
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
					saveData.name = "Sample";
					saveData.agent.name = username.value
					ztmService.joinMesh(saveData.name, saveData)
					.then(res => {
						tryLoading.value = false;
						if(!!res){
							visibleTry.value = false;
							toast.add({ severity: 'success', summary:'Tips', detail: 'Joined.', life: 3000 });
							loaddata();
						}
					})
					.catch(err => {
						tryLoading.value = false;
						console.log('Request Failed', err)
					});
				}
			}).catch((e)=>{
				tryLoading.value = false;
			});
		}
	})
}
const openTryMesh = () => {
	visibleTry.value = true;
}
const addMesh = () => {
	selectMesh.value = null;
	visibleEditor.value = true;
}
watch(()=> meshes, ()=>{
	if(selectedMesh.value && !meshes.value.find((mesh)=> mesh?.name == selectedMesh.value?.name)){
		store.commit('account/setSelectedMesh', null);
	} else if(!selectedMesh.value && meshes.value.length>0){
		store.commit('account/setSelectedMesh', meshes.value[0]);
	}
},{
	deep:true
})
onMounted(() => {
	if(platform.value=='android'){
		setTimeout(() => {
			store.dispatch('account/meshes');
		},2000)
	}else{
		store.dispatch('account/meshes');
	}
});
</script>

<template>
	<div class="flex flex-row min-h-screen">
		<div v-if="!visibleEditor || (!!visibleEditor && !!meshes && meshes.length>0)" class="relative h-full min-h-screen" :class="{'w-22rem':(!!visibleEditor),'w-full':(!visibleEditor),'mobile-hidden':(!!visibleEditor)}">
			<AppHeader :main="true">
					<template #center>
						<i class="pi pi-star-fill mr-2" style="color: orange;"/>
						<b>{{t('My Meshes')}} ({{meshes.length}})</b>
					</template>
					<template #end> 
						<Button icon="pi pi-refresh" text @click="loaddata"  :loading="loader"/>
						<Button v-if="hasPubHub && !!meshes && meshes.length>0 && !meshes.find((m)=>m.name == 'Sample')"  :loading="tryLoading" v-tooltip="t('Live Sample')" icon="pi pi-sparkles" text @click="openTryMesh" />
						<Button v-if="!!meshes && meshes.length>0" icon="pi pi-plus"  v-tooltip="t('Join')" @click="addMesh"/>
					</template>
			</AppHeader>
			<Loading v-if="loading"/>
			<ScrollPanel class="absolute-scroll-panel" v-else-if="meshes.length >0">
			<div class="text-center p-2">
				<div class="grid text-left p-0 m-0" >
						<div class="p-2" :class="(!visibleEditor)?'col-12 md:col-6 lg:col-3':'col-12'" v-for="(mesh,hid) in meshes" :key="hid">
							 <div :class="selectedMesh?.name == mesh.name?'surface-card-selected':''" class="surface-card surface-card-hover shadow-2 p-3 border-round relative" @click="select(mesh)">
									 <div class="flex justify-content-between mb-3">
											 <div>
													<span class="block text-tip font-medium mb-3">
														{{decodeURI(mesh.name)}}
													</span>
													<Status :run="mesh.connected" :errors="mesh.errors" :text="mesh.connected?t('Connected'):t('Disconnect')" />
											 </div>
											 <Button size="small" type="button" severity="secondary" icon="pi pi-ellipsis-v" @click="showAtionMenu($event,mesh)" aria-haspopup="true" aria-controls="actionMenu" />
											 <Menu ref="actionMenu" :model="[{
															label: t('Actions'),
															items: [
																	{
																			label: t('Edit'),
																			icon: 'pi pi-pencil',
																			command: () => {
																				editMesh();
																			}
																	},
																	{
																			label: t('Leave'),
																			icon: 'pi pi-trash',
																			command: () => {
																				deleteMesh()
																			}
																	}
															]
													}]" :popup="true" />
									 </div>
										<span class="text-tip">Hubs: </span>
										<span class="text-green-500"><Badge v-tooltip="mesh.bootstraps.join('\n')" class="relative" style="top:-2px" :value="mesh.bootstraps.length"></Badge></span>
										<i v-if="selectedMesh?.name == mesh.name" class="iconfont icon-check text-primary-500 text-4xl absolute" style="right: 10px;bottom: 10px;"/>
							 </div>
					 </div>
				</div>
			</div>
			</ScrollPanel>
			<Empty v-else-if="hasPubHub" :title="emptyMsg" :cancelButton="t('Live Sample')" @cancel="openTryMesh" :button="t('Join Mesh')" @primary="() => visibleEditor = true"/>
			<Empty v-else :title="emptyMsg" :button="t('Join Mesh')" @primary="() => visibleEditor = true"/>
		
		</div>
		<div class="flex-item h-full" v-if="!!visibleEditor">
			<div class="shadow mobile-fixed h-full">
				<MeshJoin
					:title="!!selectedMenu?t('Edit Mesh'):null" 
					:pid="selectedMenu?.name" 
					@save="join" 
					@back="() => {selectedMenu=null;visibleEditor=false;}"/>
			</div>
		</div>
		
		<Dialog :header="t('Live Sample')" v-model:visible="visibleTry" modal :dismissableMask="true">
			<div>
				<div class="flex mt-2 w-full">
					<InputText size="small" placeholder="Username" v-model="username"  class="flex-item"></InputText>
					<Button :loading="tryLoading" size="small" :disabled="!username || username == 'root'" label="Join" class="ml-2"  @click="tryMesh"></Button>
				</div>
				<div class="pt-2 opacity-70 text-sm">
					<i class="pi pi-info-circle relative" style="top: 1px;"/> {{t('Join our sample mesh for a first experience of ZTM')}}
				</div>
			</div>
		</Dialog>
	</div>
</template>

<style scoped lang="scss">
:deep(.p-dataview-content) {
  background-color: transparent !important;
}
:deep(.p-tabview-nav),
:deep(.p-tabview-panels),
:deep(.p-tabview-nav-link){
	background: transparent !important;
}
:deep(.p-tabview-panels){
	padding: 0;
}
</style>
