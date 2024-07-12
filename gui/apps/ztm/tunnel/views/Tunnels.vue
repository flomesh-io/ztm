<script setup>
import { ref, onMounted,onActivated, computed,watch } from "vue";
import { useRouter } from 'vue-router'
import ZtmService from '@/service/ZtmService';
import TunnelService from '../service/TunnelService';
import { useConfirm } from "primevue/useconfirm";
import { useStore } from 'vuex';
const store = useStore();

const confirm = useConfirm();
const router = useRouter();
const ztmService = new ZtmService();
const tunnelService = new TunnelService();
const tunnels = ref([]);
const status = ref({});
const scopeType = ref('All');
const portMap = ref({});
const loading = ref(false);
const loader = ref(false);
const visibleEditor = ref(false);

onActivated(()=>{
	getTunnels();
})
const emits = defineEmits(['create', 'edit'])
const error = ref();
const getTunnels = () => {
	visibleEditor.value = false;
	loading.value = true;
	loader.value = true;
	tunnelService.getTunnels()
		.then(res => {
			console.log("tunnels:")
			console.log(res)
			loading.value = false;
			setTimeout(() => {
				loader.value = false;
			},2000)
			error.value = null;
			tunnels.value = res || [];
		})
		.catch(err => {
			loading.value = false;
			loader.value = false;
			error.value = err;
			console.log('Request Failed', err)
		}); 
}


watch(()=>selectedMesh,()=>{
	getTunnels();
},{
	deep:true,
	immediate:true
});
const tunnelsFilter = computed(() => {
	return tunnels.value.filter((tunnel)=>{
		return (typing.value == '' || tunnel.name.indexOf(typing.value)>=0 ) 
	})
});


const typing = ref('');
const save = () => {
	visibleEditor.value = false;
	getTunnels();
	selectedTunnel.value = null;
	visibleEditor.value = false;
}
const selectedTunnel = ref(null);
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
        ]
    }
]);
const showAtionMenu = (event, tunnel) => {
	selectedTunnel.value = tunnel;
	actionMenu.value.toggle(event);
};
const openEditor = () => {
	visibleEditor.value = false;
	setTimeout(()=>{
		visibleEditor.value = true;
	},300);
}
const layout = ref('grid');
const expandedRows = ref({});
const back = () => {
	router.go(-1)
}

const windowWidth = ref(window.innerWidth);
const isMobile = computed(() => windowWidth.value<=768);

const emptyMsg = computed(()=>{
	return 'No tunnels.'
});
const create = () => {
	emits('create')
}

const edit = (d) => {
	emits('edit',d)
}

</script>

<template>
	<div class="flex flex-row min-h-screen"  :class="{'embed-ep-header':false}">
		<div  class="relative h-full" :class="{'w-24rem':(!!visibleEditor),'w-full':(!visibleEditor),'mobile-hidden':(!!visibleEditor)}">
			<AppHeader :main="true" >
					<template #start>
						<Button icon="pi pi-arrow-right-arrow-left" text />
					</template>
					<template #center>
						<b>Tunnels</b>
					</template>
			
					<template #end> 
						<Button icon="pi pi-refresh" text @click="getTunnels"  :loading="loader"/>
						<DataViewLayoutOptions v-if="!isMobile" v-model="layout" style="z-index: 2;"/>
						<Button icon="pi pi-plus"   @click="create"/>
					</template>
			</AppHeader>
			<Card class="nopd" v-if="!error">
				<template #content>
					<InputGroup class="search-bar" >
						<Button :disabled="!typing" icon="pi pi-search"  :label="null"/>
						<Textarea @keyup="watchEnter" v-model="typing" :autoResize="true" class="drak-input bg-gray-900 text-white flex-1" placeholder="Type tunnel name" rows="1" cols="30" />
						
					</InputGroup>
				</template>
			</Card>
			<Loading v-if="loading"/>
			<ScrollPanel class="w-full absolute" style="bottom: 0;"  :style="{'top':'75px'}" v-else-if="tunnelsFilter && tunnelsFilter.length >0">
			<div class="text-center">
				<DataTable v-if="layout == 'list'" class="nopd-header w-full" :value="tunnelsFilter" dataKey="id" tableStyle="min-width: 50rem">
						<Column expander style="width: 5rem" />
						<Column header="Tunnel">
							<template #body="slotProps">
								<span class="block text-tip font-medium"><i class="pi pi-server text-tip"></i> {{slotProps.name}}</span>
							</template>
						</Column>
						<Column header="Inbound">
							<template #body="slotProps">
								<Badge :value="slotProps.inbounds.length"/>
							</template>
						</Column>
						<Column header="Outbound">
							<template #body="slotProps">
								<Badge :value="slotProps.outbounds.length"/>
							</template>
						</Column>
						<Column header="Action"  style="width: 110px;">
							<template #body="slotProps">
								
							</template>
						</Column>
				</DataTable>
				<div v-else class="grid text-left mt-1 px-3" v-if="tunnelsFilter && tunnelsFilter.length >0">
						<div  :class="(!visibleEditor)?'col-12 md:col-6 lg:col-4':'col-12'" v-for="(tunnel,hid) in tunnelsFilter" :key="hid">
							 <div class="surface-card shadow-2 p-3 border-round">
									 <div class="flex justify-content-between">
											 <div>
													<span class="block text-tip font-medium mb-3"><i class="pi pi-server text-tip relative" style="top: 2px;"></i> {{tunnel.name}}</span>
													<div class="text-left w-full" ><Tag  severity="contrast" value="Contrast" >Local</Tag> <Tag severity="secondary" value="Secondary">{{tunnel.protocol}}</Tag> </div>
											 </div>
											 <div class="flex">
												 <div v-tooltip="'Connect'"   class="pointer flex align-items-center justify-content-center bg-primary-sec border-round mr-2" :style="'width: 2.5rem; height: 2.5rem'">
														 <i class="pi pi-circle text-xl"></i>
												 </div>
												 <div  @click="showAtionMenu($event, tunnel)" aria-haspopup="true" aria-controls="actionMenu" class="pointer flex align-items-center justify-content-center p-button-secondary border-round" style="width: 2rem; height: 2rem">
													<i class="pi pi-ellipsis-v text-tip text-xl"></i>
												 </div>
											 </div>
									 </div>
							 </div>
					 </div>
				</div>
				<Menu ref="actionMenu" :model="actions" :popup="true" />
			</div>
			</ScrollPanel>
			<Empty v-else :title="emptyMsg" :error="error"/>
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