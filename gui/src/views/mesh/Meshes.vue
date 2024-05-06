<script setup>
import { ref, onMounted,computed } from "vue";
import { useRouter } from 'vue-router'
import PipyProxyService from '@/service/PipyProxyService';
import MeshJoin from './MeshJoin.vue';
import { useConfirm } from "primevue/useconfirm";
import { useStore } from 'vuex';
const store = useStore();
import freeSvg from "@/assets/img/free.svg";
const router = useRouter();
const confirm = useConfirm();
const pipyProxyService = new PipyProxyService();
const meshes = ref([]);
const status = ref({});
const scopeType = ref('All');

onMounted(() => {
	loaddata();
});
const loading = ref(false);
const loader = ref(false);
const loaddata = () => {
	active.value = 0;
	loading.value = true;
	loader.value = true;
	pipyProxyService.getMeshes()
		.then(res => {
			console.log(res);
			loading.value = false;
			setTimeout(() => {
				loader.value = false;
			},2000)
			meshes.value = res;
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
	confirm.require({
	    message: `Are you sure to exit ${decodeURI(name)} ?`,
	    header: 'Tips',
	    icon: 'pi pi-exclamation-triangle',
	    accept: () => {
				pipyProxyService.deleteMesh(name)
					.then(res => {
						console.log(res);
						setTimeout(()=>{
							loaddata();
						},1000);
						selectedMesh.value = null;
						visibleEditor.value = false;
					})
					.catch(err => {
						console.log('Request Failed', err)
						setTimeout(()=>{
							loaddata();
						},1000);
						selectedMesh.value = null;
						visibleEditor.value = false;
					}); 
	    },
	    reject: () => {
	    }
	});
	
}
const changeStatus = (mesh,val) => {
	status.value[`${mesh.host}:${mesh.port}`] = val;
}
const active = ref(0);
const join = () => {
	active.value = 0;
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
</script>

<template>
	
	<TabView class="pt-3 pl-3 pr-3" v-model:activeIndex="active">
	    <TabPanel>
				<template #header>
					<div>
						<i class="pi pi-star-fill mr-2" style="color: orange;"/>My Meshes
						<i @click="loaddata" class="pi pi-refresh ml-2 refresh-icon" :class="{'spiner':loader}"/>
					</div>
				</template>
				<Loading v-if="loading"/>
				<div v-else class="text-center">
					<div class="grid text-left" v-if="meshes && meshes.length >0">
							<div class="col-12 md:col-6 lg:col-3" v-for="(mesh,hid) in meshes" :key="hid">
	               <div class="surface-card shadow-2 p-3 border-round">
	                   <div class="flex justify-content-between mb-3">
	                       <div>
	                            <span class="block text-500 font-medium mb-3">
																
																{{decodeURI(mesh.name)}}
															</span>
															<Status :run="mesh.connected" :errors="mesh.errors" :text="mesh.connected?'Connected':'Disconnect'" />
	                       </div>
												 <Button size="small" type="button" severity="secondary" icon="pi pi-ellipsis-v" @click="showAtionMenu($event, mesh)" aria-haspopup="true" aria-controls="actionMenu" />
												 <Menu ref="actionMenu" :model="actions" :popup="true" />
	                   </div>
	                    <span class="text-500">Hubs: </span>
											<span class="text-green-500"><Badge v-tooltip="mesh.bootstraps.join('\n')" class="relative" style="top:-2px" :value="mesh.bootstraps.length"></Badge></span>
	               </div>
	           </div>
					</div>
					<img v-else :src="freeSvg" class="w-5 h-5 mx-aut" style="margin: auto;"  />
				</div>
			</TabPanel>
	    <TabPanel >
				<template #header>
					<i class="pi pi-angle-double-up mr-2" /> Join
				</template>
	      <MeshJoin @save="join"/>
	    </TabPanel>
	</TabView>
	<Dialog :closable="false" class="noheader" v-model:visible="visibleEditor" modal header="Edit Mesh" :style="{ width: '90%' }">
		<MeshJoin title="Edit Mesh" v-if="selectedMesh" :pid="selectedMesh?.name" @save="join" @cancel="() => visibleEditor=false"/>
	</Dialog>
</template>

<style scoped lang="scss">
:deep(.p-dataview-content) {
  background-color: transparent !important;
}
.drak-input{
	border: none;
	min-height: 33px !important;
}
:deep(.p-tabview-nav),
:deep(.p-tabview-panels),
:deep(.p-tabview-nav-link){
	background: transparent !important;
}
</style>