<script setup>
import { ref,onActivated,watch, computed } from "vue";
import { useRouter } from 'vue-router'
import PipyProxyService from '@/service/PipyProxyService';
import MeshSelector from './common/MeshSelector.vue'
import EndpointDetail from './EndpointDetail.vue'
import { useStore } from 'vuex';
import { useConfirm } from "primevue/useconfirm";
import freeSvg from "@/assets/img/free.svg";
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


const expandNode = ref();
const expand = (node) => {
	if (!!node) {
		node.loading = true;
		node.children = [];
		expandNode.value = node;
		/*
		 * get services
		 */
		pipyProxyService.getServices({
			mesh:selectedMesh.value?.name,
			ep:node?.id
		})
			.then(res => {
				const _children = res;
				_children.forEach((service,sid)=>{
					service.key = node.key + '-s-' + sid,
					service.label = service.name +"xcxxxxxxxxxsc";
					service.type = "service";
					node.children.push(service);
				});
				node.loading = false;
			})
			.catch(err => {
				node.loading = false;
				console.log('Request Failed', err)
			}); 

		/*
		 * get ports
		 */
		pipyProxyService.getPorts({
			mesh:selectedMesh.value?.name,
			ep:node?.id
		})
			.then(res => {
				const _children = res;
				_children.forEach((port,pid)=>{
					port.key = node.key + '-p-' + pid,
					port.label = `${port.listen?.ip}:${port.listen?.port}`;
					port.type = "port";
					node.children.push(port);
				});
			})
			.catch(err => console.log('Request Failed', err)); 
	}
};

const deleteService = (service) => {
	pipyProxyService.deleteService({
		mesh:selectedMesh.value?.name,
		ep:expandNode.value?.id,
		name: service.name,
		proto: service.protocol,
	},() => {
		console.log('Delete Success', err)
		setTimeout(()=>{
			expand(expandNode.value);
		},1000)
	}); 
}
const deletePort = (port) => {
	pipyProxyService.deletePort({
		mesh:selectedMesh.value?.name,
		ep:expandNode.value?.id,
		proto: port.protocol,
		ip: port?.listen?.ip,
		port: port?.listen?.port
	},() => {
		setTimeout(()=>{
			expand(expandNode.value);
		},1000)
	});
}

const actionTarget = ref({})
const actionMenu = ref();
const actions = ref([
    {
        label: 'Actions',
        items: [
            {
                label: 'Delete',
                icon: 'pi pi-trash',
								command: () => {
									if(actionTarget.value?.type == 'port'){
										deletePort(actionTarget.value?.node);
									}else if(actionTarget.value?.type == 'service'){
										deleteService(actionTarget.value?.node);
									}
								}
            }
        ]
    }
]);

const showAtionMenu = (node, type) => {
	actionTarget.value = { node, type };
	actionMenu.value.toggle(event);
};
const selectEp = ref();
const select = (node) => {
	selectEp.value = node
}
const toggleLeft = () => {
	store.commit('account/setMobileLeftbar', !store.getters['account/mobileLeftbar']);
}
</script>

<template>
	
	<div class="flex flex-row">
		<div :class="{'w-22rem':!!selectEp,'w-full':!selectEp,'mobile-hidden':!!selectEp}">
			<AppHeader :main="true">
					<template #start>
						<Button @click="toggleLeft" class="mobile-show" icon="pi pi-bars" text  />
					</template>
			
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
			<img v-else :src="freeSvg" class="w-5 h-5 mx-aut" style="margin: auto;"  />
			<Menu ref="actionMenu" :model="actions" :popup="true" />
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