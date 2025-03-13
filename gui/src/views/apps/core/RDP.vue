<script setup>
import { ref, onMounted,onActivated, computed,watch } from "vue";
import AppService from '@/service/AppService';
import ZtmService from '@/service/ZtmService';
import { merge } from '@/service/common/request';
import { useStore } from 'vuex';
import { useI18n } from 'vue-i18n';

const { t, locale } = useI18n();
const props = defineProps(['app']);
const emits = defineEmits(['close'])
const selectedMesh = computed(() => {
	return store.getters["account/selectedMesh"]
});
const store = useStore();
const appService = new AppService();
const ztmService = new ZtmService();
const save = (tunnel) => {
	getEndpoints(tunnel);
}
const endpoints = ref([]);
const loading = ref(false);
const loader = ref(false);
const error = ref();
const filter = ref({
	keyword:'',
	limit:50,
	offset:0
})
const more = ref(false);
const getEndpoints = () => {
	loading.value = true;
	loader.value = true;
	ztmService.getEndpoints(selectedMesh.value?.name,filter.value).then((res)=>{
		loading.value = false;
		setTimeout(() => {
			loader.value = false;
		},2000)
		error.value = null;
		more.value = res.length == filter.value.limit;
		if(filter.value.offset == 0){
			endpoints.value = res || [];
		} else {
			endpoints.value = endpoints.value.concat(res||[]);
		}
		(res || []).forEach((ep)=>{
			if(!tunnels.value[ep.id]){
				tunnels.value[ep.id] = {
					starting: true,
				};
			}
		})
		loadtunnels(res);
	})
}

const nextEndpoints = () => {
	filter.value.offset += filter.value.limit;
	more.value = false;
	getEndpoints();
}
const tunnels = ref({});
const loadtunnels = (eps) => {
	appService.getTunnels({
		mesh:selectedMesh.value,
		eps,
		callback(res){
			if(filter.value.offset == 0){
				tunnels.value = res;
			} else {
				tunnels.value = {
					...tunnels.value,
					...res
				}
			}
			
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

const searchEps = () => {
	filter.value.offset = 0;
	more.value = false;
	getEndpoints();
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
						<b class="mr-2">RDP | </b>
						<IconField>
							<InputIcon class="pi pi-search" />
							<InputText style="background-color: transparent;" v-model="filter.keyword" :placeholder="t('Search')" @input="searchEps"/>
						</IconField>
					</template>
			
					<template #end> 
						<Button icon="pi pi-refresh" text @click="getEndpoints"  :loading="loader"/>
					</template>
			</AppHeader>
			<Loading v-if="loading && filter.offset==0"/>
			<ScrollPanel v-else-if="endpoints && endpoints.length >0">
			<DataView class="message-list" style="margin-top: 50px;" :value="endpoints">
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
												<Button v-tooltip="t('Connect')" @click="startTunnel(node)" :loading="tunnels[node.id]?.starting" v-if="!tunnels[node.id]?.outbound?.targets" raised icon="pi pi-caret-right" size="small" />
												<Button v-tooltip="t('Disconnect')" @click="stopRDPTunnel(node)" :loading="tunnels[node.id]?.stoping" severity="danger" v-else raised icon="pi pi-pause" size="small" />
											</div>
										</div>
								</div>
							</div>
							
							<div v-if="more" class="message-item pointer text-center py-3 opacity-50" @click="nextEndpoints" >
								<i v-if="!loading" class="pi pi-arrow-down mr-1 relative" style="top: 1px;"/> 
								<i v-else class="pi pi-spin pi-spinner relative" style="top: 2px;margin: 0;width:16px;height: 16px;font-size: 16px;"></i>
								{{t('More')}}
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