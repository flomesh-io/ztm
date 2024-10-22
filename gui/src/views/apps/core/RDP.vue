<script setup>
import { ref, onMounted,onActivated, computed,watch } from "vue";
import AppService from '@/service/AppService';
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
onMounted(()=>{
	getEndpoints()
})
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
		endpoints.value = res || [];
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
const startTunnel = (ep) => {
	appService.startEDPTunnel({
		mesh:selectedMesh.value,
		ep
	}).then((res)=>{
		
	})
}
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
							<div class="flex flex-col message-item pointer" v-for="(node, index) in slotProps.items" :key="index" @click="select(node)">
								<div class="flex flex-col py-3 px-3 gap-4 w-full" :class="{ 'border-t border-surface-200 dark:border-surface-700': index !== 0 }">
										<div class="w-40 relative">
											<Avatar icon="pi pi-user" size="small" style="background-color: #ece9fc; color: #2a1261" />
										</div>
										<div class="flex-item" style="min-width: 150px;">
												<div class="flex">
													<div class="flex-item pt-1">
														<b>{{ node.name || 'Unknow EP' }}</b>
														<Tag class="ml-2" v-if="node.id == selectedMesh?.agent?.id" severity="contrast" >Local</Tag>
													</div>
												</div>
										</div>
										<div class="grid align-items-center justify-content-end pr-2 gap-1 pt-3" v-if="tunnels[node.id]">
											<Tag v-if="tunnels[node.id]?.outbound?.targets[0]" severity="secondary" value="Secondary">Target {{tunnels[node.id]?.outbound?.targets[0]?.port}}</Tag> 
											<Tag v-if="tunnels[node.id]?.inbound?.listens[0]" severity="secondary" value="Secondary">Listen {{tunnels[node.id]?.inbound?.listens[0]?.port}}</Tag> 
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