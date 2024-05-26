<script setup>
import { ref,onActivated,watch, computed } from "vue";
import { useRouter } from 'vue-router'
import PipyProxyService from '@/service/PipyProxyService';
import MeshSelector from './common/MeshSelector.vue'
import { useStore } from 'vuex';
const store = useStore();
import { useConfirm } from "primevue/useconfirm";
import freeSvg from "@/assets/img/free.svg";
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime)

const router = useRouter();
const pipyProxyService = new PipyProxyService();
const confirm = useConfirm();
const loading = ref(false);
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

const active = ref(0);

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
</script>

<template>
	<TabView class="pt-3 pl-3 pr-3" v-model:activeIndex="active">
		<TabPanel>
			<template #header>
				<div>
					<i class="pi pi-chart-scatter mr-2"/> Endpoints
					<i @click="getEndpoints" class="pi pi-refresh ml-2 refresh-icon" :class="{'spiner':loader}"/>
				</div>
			</template>
			<Loading v-if="loading"/>
			<div v-else class="text-center">
				<Tree 
					v-if="endpoints && endpoints.length >0" 
					:value="endpoints" 
					@node-expand="expand" 
					loadingMode="icon" 
					class="transparent">
					<template #default="slotProps">
							<div v-if="slotProps.node.type == 'ep'" class="w-full text-left flex flex-wrap py-1" >
								
								<div>
									<div>
										<Status :run="slotProps.node.online" :tip="timeago(slotProps.node.heartbeat)"  /> <b>EP: {{ slotProps.node.label || slotProps.node.id }} <span v-if="!!slotProps.node.username">({{slotProps.node.username}})</span></b>
										<span class="ml-3"><Tag severity="contrast" >{{slotProps.node.isLocal?'Local':'Remote'}}</Tag></span>
									</div>
									<div v-if="!!slotProps.node.port || !!slotProps.node.ip">
										<span class="font-normal text-tip" style="margin-left: 24px;">{{slotProps.node.ip}}:{{slotProps.node.port}}</span>
									</div>
								</div>
							</div>
							<div v-else-if="slotProps.node.type == 'service'" class="flex align-items-center flex-wrap w-full text-left justify-content-center py-2">
								
								<Avatar icon="pi pi-server" />
								<div class="ml-3">
									<div>
										<b>Service: {{ slotProps.node.label }}</b>
									</div>
									<div>
										<span v-if="!!slotProps.node.port" class="font-normal text-tip mr-2">{{slotProps.node.host}}:{{slotProps.node.port}}</span>
										<span><Tag>{{slotProps.node.protocol}}</Tag></span>
									</div>
								</div>
								<Avatar shape="circle" icon="pi pi-ellipsis-v" v-tooltip="'Delete Service'"  @click="showAtionMenu(slotProps.node,'service')" class="pointer ml-4 vm" style="background-color: transparent;" />
							</div>
							<div class="flex flex-wrap w-full text-left align-items-center justify-content-center py-1" v-else-if="slotProps.node.type == 'port'">
								
								<Avatar icon="pi pi-bullseye" />
								<div class="ml-3">
									<div>
										<b>Port: {{ slotProps.node.label }}</b>
										
									</div>
									<div>
										<span v-if="!!slotProps.node.target" class="font-normal text-tip mr-1">{{slotProps.node.target.service}}</span>
										<span><Tag>{{slotProps.node.protocol}}</Tag></span>
									</div>
								</div>
								<Avatar shape="circle" icon="pi pi-ellipsis-v" v-tooltip="'Delete Port'"  @click="showAtionMenu(slotProps.node, 'port')" class="pointer ml-4 vm" style="background-color: transparent;"/>
							</div>
					</template>
				</Tree>
				<img v-else :src="freeSvg" class="w-5 h-5 mx-aut" style="margin: auto;"  />
				<Menu ref="actionMenu" :model="actions" :popup="true" />
			</div>
		</TabPanel>
	</TabView>
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