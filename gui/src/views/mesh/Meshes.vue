<script setup>
import { ref, onMounted,computed } from "vue";
import { useRouter } from 'vue-router'
import PipyProxyService from '@/service/PipyProxyService';
import MeshJoin from './MeshJoin.vue';
import { useConfirm } from "primevue/useconfirm";
import { useStore } from 'vuex';
const store = useStore();
const router = useRouter();
const confirm = useConfirm();
const pipyProxyService = new PipyProxyService();
const meshes = ref([]);
const status = ref({});
const scopeType = ref('All');

const platform = computed(() => {
	return store.getters['account/platform']
});
onMounted(() => {
	if(platform.value=='android'){
		loading.value = true;
		loader.value = true;
		setTimeout(() => {
			loaddata();
		},2000)
	}else{
		loaddata();
	}
});
const isChat = computed(() => store.getters['account/isChat']);
const loading = ref(false);
const loader = ref(false);
const loaddata = () => {
	visibleEditor.value = false;
	loading.value = true;
	loader.value = true;
	pipyProxyService.getMeshes()
		.then(res => {
			console.log(res);
			loading.value = false;
			setTimeout(() => {
				loader.value = false;
			},2000)
			meshes.value = res || [];
			store.commit('account/setMeshes', res);
		})
		.catch(err => {
			loading.value = false;
			loader.value = false;
			console.log('Request Failed', err)
		}); 
}
const deleteMesh = () => {
	const name = selectedMesh.value?.name;
	if(!name){
		return
	}
	pipyProxyService.deleteMesh(name,() => {
		setTimeout(()=>{
			loaddata();
			store.dispatch('account/meshes');
		},1000);
		selectedMesh.value = null;
		visibleEditor.value = false;
	});
	
}
const changeStatus = (mesh,val) => {
	status.value[`${mesh.host}:${mesh.port}`] = val;
}
const join = () => {
	visibleEditor.value = false;
	setTimeout(()=>{
		loaddata();
	},1000);
	selectedMesh.value = null;
	visibleEditor.value = false;
}

const selectedMesh = ref();
const actionMenu = ref();
const actions = ref([
    {
        label: 'Actions',
        items: [
            {
                label: 'Edit',
                icon: 'pi pi-pencil',
								command: () => {
									openEditor()
								}
            },
            {
                label: 'Leave',
                icon: 'pi pi-trash',
								command: () => {
									deleteMesh()
								}
            }
        ]
    }
]);
const showAtionMenu = (event, mesh) => {
	selectedMesh.value = mesh;
	actionMenu.value[0].toggle(event);
};
const visibleEditor = ref(false);
const openEditor = () => {
	visibleEditor.value = true;
}

const emptyMsg = computed(()=>{
	return `First, join a ${isChat.value?'Channel':'Mesh'}.`
});

</script>

<template>
	<div class="flex flex-row min-h-screen">
		<div class="relative h-full" :class="{'w-22rem':(!!visibleEditor),'w-full':(!visibleEditor),'mobile-hidden':(!!visibleEditor)}">
			<AppHeader :main="true">
					<template #center>
						<i class="pi pi-star-fill mr-2" style="color: orange;"/>
						<b>My {{isChat?'Channels':'Meshes'}} ({{meshes.length}})</b>
					</template>
					<template #end> 
						<Button icon="pi pi-refresh" text @click="loaddata"  :loading="loader"/>
						<Button icon="pi pi-plus"  label="Join" @click="() => visibleEditor = true"/>
					</template>
			</AppHeader>
			<Loading v-if="loading"/>
			<ScrollPanel class="w-full absolute" style="top:35px;bottom: 0;" v-else-if="meshes.length >0">
			<div class="text-center px-3">
				<div class="grid mt-1 text-left" >
						<div :class="(!visibleEditor)?'col-12 md:col-6 lg:col-3':'col-12'" v-for="(mesh,hid) in meshes" :key="hid">
							 <div class="surface-card shadow-2 p-3 border-round">
									 <div class="flex justify-content-between mb-3">
											 <div>
														<span class="block text-tip font-medium mb-3">
															
															{{decodeURI(mesh.name)}}
														</span>
														<Status :run="mesh.connected" :errors="mesh.errors" :text="mesh.connected?'Connected':'Disconnect'" />
											 </div>
											 <Button size="small" type="button" severity="secondary" icon="pi pi-ellipsis-v" @click="showAtionMenu($event, mesh)" aria-haspopup="true" aria-controls="actionMenu" />
											 <Menu ref="actionMenu" :model="actions" :popup="true" />
									 </div>
										<span class="text-tip">Hubs: </span>
										<span class="text-green-500"><Badge v-tooltip="mesh.bootstraps.join('\n')" class="relative" style="top:-2px" :value="mesh.bootstraps.length"></Badge></span>
							 </div>
					 </div>
				</div>
			</div>
			</ScrollPanel>
			<Empty v-else :title="emptyMsg"/>
		</div>
		<div class="flex-item" v-if="!!visibleEditor">
			<div class="shadow mobile-fixed">
				<MeshJoin
					:title="!!selectedMesh?(isChat?'Edit Channel':'Edit Mesh'):null" 
					:pid="selectedMesh?.name" 
					@save="join" 
					@back="() => {selectedMesh=null;visibleEditor=false;}"/>
			</div>
		</div>
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