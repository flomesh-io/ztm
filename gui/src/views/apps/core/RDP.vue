<script setup>
import { ref, onMounted,onActivated, computed,watch } from "vue";
import AppService from '@/service/AppService';
import { merge } from '@/service/common/request';
import { useStore } from 'vuex';

const props = defineProps(['app']);
const emits = defineEmits(['close'])
const selectedMesh = computed(() => {
	return store.getters["account/selectedMesh"]
});
const store = useStore();
const appService = new AppService();
const save = (tunnel) => {
	getEndpoints(tunnel);
}
const endpoints = ref([]);
const loading = ref(false);
const loader = ref(false);
const error = ref();
const getEndpoints = () => {
	loading.value = true;
	loader.value = true;
	appService.getTunnelEndpoints(selectedMesh.value).then((res)=>{
		loading.value = false;
		setTimeout(() => {
			loader.value = false;
		},2000)
		error.value = null;
		endpoints.value = [];
		if(res){
			endpoints.value = res.filter((n)=>n.id != selectedMesh.value?.agent?.id)
		}
		endpoints.value.forEach((ep)=>{
			tunnels.value[ep.id] = {
				starting: true,
			};
		})
		loadtunnels(res);
	})
}
const tunnels = ref({});
const loadtunnels = (eps) => {
	appService.getTunnels({
		mesh:selectedMesh.value,
		eps,
		callback(res){
			tunnels.value = res;
		},
		error(){
			
		}
	});
}

const back = () => {
	emits('close')
}
const getTunnel = (ep) => {
	merge(appService.getTunnel({
		mesh:selectedMesh.value,
		ep
	})).then((ary)=>{
		ary.forEach((res)=>{
			tunnels.value[ep.id].name = res.data.name;
			tunnels.value[ep.id].proto = res.data.protocol;
			tunnels.value[ep.id][res.type] = res.data;
		});
	});
}
const stopRDPTunnel = (ep) => {
	tunnels.value[ep.id].stoping = true
	appService.stopRDPTunnel({
		mesh:selectedMesh.value,
		ep
	}).then(()=>{
		tunnels.value[ep.id] = {
			stoping: false,
			starting: false,
		};
	})
}
const startTunnel = (ep) => {
	if(!tunnels.value[ep.id]){
		tunnels.value[ep.id] = {
			starting: true
		}
	} else {
		tunnels.value[ep.id].starting = true
	}
	appService.startRDPTunnel({
		mesh:selectedMesh.value,
		ep,
		callback(){
			getTunnel(ep, ()=>{
				tunnels.value[ep.id].starting = false;
			})
		}
	});
}
watch(()=> selectedMesh.value,()=> getEndpoints(), {deep:true})
onMounted(()=>{
	getEndpoints()
})
</script>

<template>
	<div class="flex flex-row min-h-screen surface-ground" >
		<div class="relative h-full w-full min-h-screen" >
			<AppHeader :back="back">
					<template #center>
						<b>RDP ({{endpoints.length}} Endpoints)</b>
					</template>
			
					<template #end> 
						<Button icon="pi pi-refresh" text @click="getEndpoints"  :loading="loader"/>
					</template>
			</AppHeader>
			<Loading v-if="loading"/>
			<ScrollPanel v-else-if="endpoints && endpoints.length >0">
			<DataView class="message-list" :value="endpoints">
					<template #list="slotProps">
							<div class="flex flex-col message-item pointer" v-for="(node, index) in slotProps.items" :key="index">
								<div class="flex flex-col py-3 px-3 gap-4 w-full" :class="{ 'border-t border-surface-200 dark:border-surface-700': index !== 0 }">
										<div class="w-40 relative">
											<Avatar icon="pi pi-user" size="small" style="background-color: #ece9fc; color: #2a1261" />
										</div>
										<div >
												<div class="flex">
													<div class="flex-item pt-1">
														<b>{{ node.name || 'Unknow EP' }}</b>
														<Tag class="ml-2" v-if="node.id == selectedMesh?.agent?.id" severity="contrast" >Local</Tag>
													</div>
												</div>
										</div>
										<div class="flex-item">
											<div class="w-full grid align-items-center justify-content-end pr-2 gap-2 pt-3">
												<Tag v-if="tunnels[node.id]?.outbound?.targets" severity="secondary" value="Secondary">Target {{tunnels[node.id]?.outbound?.targets[0]?.port}}</Tag> 
												<Tag v-if="tunnels[node.id]?.inbound?.listens" severity="secondary" value="Secondary">Listen {{tunnels[node.id]?.inbound?.listens[0]?.port}}</Tag> 
												<Button v-tooltip="'Connect'" @click="startTunnel(node)" :loading="tunnels[node.id]?.starting" v-if="!tunnels[node.id]?.outbound?.targets" raised icon="pi pi-caret-right" size="small" />
												<Button v-tooltip="'Disconnect'" @click="stopRDPTunnel(node)" :loading="tunnels[node.id]?.stoping" severity="danger" v-else raised icon="pi pi-pause" size="small" />
											</div>
										</div>
								</div>
							</div>
					</template>
			</DataView>
			</ScrollPanel>
			<Empty v-else title="No endpoint."/>
		</div>
	</div>
</template>

<style scoped lang="scss">
	:deep(.empty-header){
		display:none;
	}
</style>