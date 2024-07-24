<script setup>
import { ref,onActivated,watch, computed } from "vue";
import { useRouter } from 'vue-router'
import ZtmService from '@/service/ZtmService';
import EndpointDetail from './EndpointDetail.vue'
import { useStore } from 'vuex';
import { useConfirm } from "primevue/useconfirm";
import dayjs from 'dayjs';
import { useToast } from "primevue/usetoast";
import relativeTime from 'dayjs/plugin/relativeTime';
import exportFromJSON from 'export-from-json';
dayjs.extend(relativeTime)

const store = useStore();
const router = useRouter();
const ztmService = new ZtmService();
const confirm = useConfirm();
const loading = ref(false);
const toast = useToast();
const loader = ref(false);
const status = ref({});
const endpoints = ref([]);

const meshes = computed(() => {
	return store.getters['account/meshes']
});
const selectedMesh = computed(() => {
	return store.getters["account/selectedMesh"]
});
const timeago = computed(() => (ts) => {
	let label = "Last heartbeat: ";
	if(ts>0){
		const date = new Date(ts);
		return label + dayjs(date).fromNow();
	} else {
		return label + "None";
	}
})
onActivated(()=>{
	getEndpoints();
})
const getEndpoints = () => {
	loading.value = true;
	loader.value = true;
	ztmService.getEndpoints(selectedMesh.value?.name)
		.then(res => {
			console.log("Endpoints:")
			console.log(res)
			loading.value = false;
			setTimeout(() => {
				loader.value = false;
			},2000)
			endpoints.value = res || [];
			endpoints.value.forEach((ep,ei)=>{
				ep.key = `${ei}`;
				ep.index = ei;
				ep.type = "ep";
				ep.label = ep?.name;
				ep.leaf = false;
				ep.loading = false;
			});
		})
		.catch(err => console.log('Request Failed', err)); 
}

const typing = ref('');

watch(()=>selectedMesh,()=>{
	if(selectedMesh.value){
		getEndpoints();
	}
},{
	deep:true,
	immediate:true
})

const selectEp = ref();
const select = (node) => {
	selectEp.value = null;
	setTimeout(()=>{
		selectEp.value = node;
	},100)
}
const emptyMsg = computed(()=>{
	if(!!selectedMesh.value?.name){
		return 'No endpoint.'
	} else {
		return `First, join a Mesh.`
	}
});
const username = ref('');
const op = ref();
const toggle = (event) => {
	username.value = "";
	permit.value = null;
	op.value.toggle(event);
}
const permit = ref(null)
const inviteEp = () => {
	ztmService.inviteEp(selectedMesh.value?.name, username.value)
		.then(data => {
			permit.value = data;
			toast.add({ severity: 'success', summary:'Tips', detail: `${username.value} permit generated.`, life: 3000 });
		})
		.catch(err => console.log('Request Failed', err)); 
}
const download = () => {
	
	exportFromJSON({ 
		data: JSON.stringify(permit.value),
		fileName:`${username.value}-permit`,
		exportType: exportFromJSON.types.txt
	})
}
</script>

<template>
	
	<div class="flex flex-row min-h-screen">
		<div class="relative h-full" :class="{'w-22rem':!!selectEp,'w-full':!selectEp,'mobile-hidden':!!selectEp}">
			<AppHeader :main="true">
					<template #center>
						<b>Endpoints ({{endpoints.length}})</b>
					</template>
			
					<template #end> 
						<Button icon="pi pi-refresh" text @click="getEndpoints"  :loading="loader"/>
						<Button v-if="selectedMesh?.agent?.username == 'root'" icon="pi pi-plus"  v-tooltip="'Invite'" aria-haspopup="true" aria-controls="op" @click="toggle"/>
					</template>
			</AppHeader>
			
			<Popover ref="op" >
				<div class="flex" v-if="!permit">
					<InputText size="small" placeholder="Username" v-model="username"  class="w-10rem"></InputText>
					<Button size="small" :disabled="!username || username == 'root'" label="Invite" class="ml-2"  @click="inviteEp"></Button>
				</div>
				<div v-else>
					<Textarea disabled style="background-color: transparent !important;" class="w-full" rows="8" cols="40" :value="JSON.stringify(permit)"/>
					<Button size="small"  label="Download" class="w-full mt-1"  @click="download"></Button>
				</div>
			</Popover>
			<Loading v-if="loading"/>
			<ScrollPanel class="w-full absolute" style="top:35px;bottom: 0;" v-else-if="endpoints && endpoints.length >0">
			<DataView class="message-list" :value="endpoints">
					<template #list="slotProps">
							<div class="flex flex-col message-item pointer" v-for="(node, index) in slotProps.items" :key="index" @click="select(node)">
								<div class="flex flex-col py-3 px-3 gap-4 w-full" :class="{ 'border-t border-surface-200 dark:border-surface-700': index !== 0 }">
										<div class="w-40 relative">
											<Avatar icon="pi pi-user" size="small" style="background-color: #ece9fc; color: #2a1261" />
											<span class="ml-2 relative" style="top: -1px;"><Tag severity="contrast" >{{node.isLocal?'Local':'Remote'}}</Tag></span>
										</div>
										<div class="flex-item">
												<div class="flex">
													<div class="flex-item pt-1">
														<b>{{ node.label || node.id }} <span v-if="!!node.username">({{node.username}})</span></b>
														
													</div>
													<Status :run="node.online" :tip="timeago(node.heartbeat)"  style="top: 12px;margin-right: 0;right: -10px;"/>
												</div>
										</div>
								</div>
							</div>
					</template>
			</DataView>
			</ScrollPanel>
			<Empty v-else :title="emptyMsg"/>
		</div>

		<div class="flex-item" v-if="!!selectEp">
			<div class="shadow mobile-fixed">
				<EndpointDetail @back="() => selectEp=false" :ep="selectEp" @reload="getEndpoints"/>
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