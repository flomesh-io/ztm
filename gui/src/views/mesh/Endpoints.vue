<script setup>
import { ref,onActivated,watch, computed } from "vue";
import { useRouter } from 'vue-router'
import PipyProxyService from '@/service/PipyProxyService';
import MeshSelector from './common/MeshSelector.vue'
import EndpointDetail from './EndpointDetail.vue'
import { useStore } from 'vuex';
import { useConfirm } from "primevue/useconfirm";
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime)

const store = useStore();
const router = useRouter();
const pipyProxyService = new PipyProxyService();
const confirm = useConfirm();
const loading = ref(false);
const loader = ref(false);
const status = ref({});
const endpoints = ref([]);

const isChat = computed(() => store.getters['account/isChat']);
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
	pipyProxyService.getEndpoints(selectedMesh.value?.name)
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
		return `First, join a ${isChat.value?'Channel':'Mesh'}.`
	}
});
</script>

<template>
	
	<div class="flex flex-row">
		<div :class="{'w-22rem':!!selectEp,'w-full':!selectEp,'mobile-hidden':!!selectEp}">
			<AppHeader :main="true">
					<template #center>
						<b>{{isChat?'Contacts':'Endpoints'}} ({{endpoints.length}})</b>
					</template>
			
					<template #end> 
						<Button icon="pi pi-refresh" text @click="getEndpoints"  :loading="loader"/>
					</template>
			</AppHeader>
			<Loading v-if="loading"/>
			<DataView v-else-if="endpoints && endpoints.length >0"  class="message-list" :value="endpoints">
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
			<Empty v-else :title="emptyMsg"/>
		</div>

		<div class="flex-item" v-if="!!selectEp">
			<div class="shadow mobile-fixed">
				<EndpointDetail @back="() => selectEp=false" :ep="selectEp"/>
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