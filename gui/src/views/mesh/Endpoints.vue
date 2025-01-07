<script setup>
import { ref,onActivated,onMounted,watch, computed } from "vue";
import { useRouter } from 'vue-router'
import ZtmService from '@/service/ZtmService';
import EndpointDetail from './EndpointDetail.vue'
import { useStore } from 'vuex';
import { useConfirm } from "primevue/useconfirm";
import { bitUnit } from '@/utils/file';
import { useToast } from "primevue/usetoast";
import { dayjs, extend } from '@/utils/dayjs';
import { downloadFile } from '@/utils/file';
import clipboard from 'clipboardy';
import { useI18n } from 'vue-i18n';
const { t, locale } = useI18n();
extend(locale.value)

const store = useStore();
const router = useRouter();
const ztmService = new ZtmService();
const confirm = useConfirm();
const loading = ref(false);
const toast = useToast();
const loader = ref(false);
const status = ref({});
const endpoints = ref([]);
const stats = ref({})
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
onMounted(()=>{
	getStatsTimer();
})
const getStats = () => {
	
	ztmService.getEndpointStats(selectedMesh.value?.name)
		.then(res => {
			stats.value = res || {};
		})
		.catch(err => console.log('Request Failed', err)); 
}
const getStatsTimer = () => {
	setTimeout(()=>{
		getStats();
		getStatsTimer();
	},3000)
}
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
		return t('No endpoint.')
	} else {
		return t(`First, join a Mesh.`)
	}
});
const username = ref('');
const identity = ref('');
const op = ref();
const toggle = (event) => {
	username.value = "";
	identity.value = "";
	permit.value = null;
	op.value.toggle(event);
}
const permit = ref(null)
const permitStr = computed(()=>{
	if(typeof(permit.value) == 'object'){
		return JSON.stringify(permit.value);
	} else if(typeof(permit.value) == 'string'){
		return permit.value;
	} else {
		return permit.value;
	}
})
const inviteEp = () => {
	ztmService.inviteEp(selectedMesh.value?.name, username.value, identity.value)
		.then(data => {
			permit.value = data;
			toast.add({ severity: 'success', summary:'Tips', detail: `${username.value} permit generated.`, life: 3000 });
		})
		.catch(err => console.log('Request Failed', err)); 
}
const download = () => {
	downloadFile({
		data: permitStr.value,
		fileName:`${username.value}-permit`,
		ext: 'txt'
	})
}
const copy = () => {
	clipboard.write(permitStr.value).then(()=>{
		toast.add({ severity: 'contrast', summary: 'Tips', detail: t(`Copied.`), life: 3000 });
	});
}
const visibleImport = ref(false);
const newInvite = () => {
	visibleImport.value = true;
	permit.value = null;
	username.value = "";
	identity.value = "";
}
</script>

<template>
	
	<div class="flex flex-row min-h-screen">
		<div class="relative h-full" :class="{'w-22rem':!!selectEp,'w-full':!selectEp,'mobile-hidden':!!selectEp}">
			<AppHeader :main="true">
					<template #center>
						<b>{{t('Endpoints')}} ({{endpoints.length}})</b>
					</template>
			
					<template #end> 
						<Button icon="pi pi-refresh" text @click="getEndpoints"  :loading="loader"/>
						<Button v-if="selectedMesh?.agent?.username == 'root'" icon="pi pi-plus"  v-tooltip="t('Invite')"  @click="newInvite"/>
					</template>
			</AppHeader>
			
			<Dialog class="noheader" v-model:visible="visibleImport" modal :dismissableMask="true">
				<div class="p-2" v-if="!permit">
					<div class="w-full">
						<CertificateUploder placeholder="Identity" v-model="identity" label="Identity"/>
					</div>
					<div class="flex mt-2 w-full">
						<InputText size="small" :placeholder="t('Username')" v-model="username"  class="flex-item"></InputText>
						<Button size="small" :disabled="!username || username == 'root'" :label="t('Invite')" class="ml-2"  @click="inviteEp"></Button>
					</div>
				</div>
				<div class="p-2" v-else>
					<Textarea disabled style="background-color: transparent !important;" class="w-full" rows="8" cols="40" :value="permitStr"/>
					<div class="flex mt-1">
						<Button size="small"  :label="t('Copy')" class="flex-item mr-1"  @click="copy"></Button>
						<Button size="small"  :label="t('Download')" class="flex-item"  @click="download"></Button>
					</div>
				</div>
			</Dialog>
			<Loading v-if="loading"/>
			<ScrollPanel class="absolute-scroll-panel" v-else-if="endpoints && endpoints.length >0">
			<DataView class="message-list" :value="endpoints">
					<template #list="slotProps">
							<div class="flex flex-col message-item pointer" v-for="(node, index) in slotProps.items" :key="index" @click="select(node)">
								<div class="flex flex-col py-3 px-3 gap-4 w-full" :class="{ 'border-t border-surface-200 dark:border-surface-700': index !== 0 }">
										<div class="w-40 relative">
											<Avatar icon="pi pi-user" size="small" style="background-color: #ece9fc; color: #2a1261" />
										</div>
										<div class="flex-item">
												<div class="flex">
													<div class="flex-item pt-1">
														<b>{{ node.label || node.id }} <span v-if="!!node.username">({{node.username}})</span></b>
														<span v-if="node.isLocal" class="ml-2 relative" style="top: -1px;"><Tag severity="contrast" >{{t('Local')}}</Tag></span>
													</div>
													<div class="flex">
														<span class="py-1 px-2 opacity-70" v-if="!selectEp && stats[node.id]">↑{{bitUnit(stats[node.id]?.send)}}</span>
														<span class="py-1 px-2 opacity-70 mr-4" v-if="!selectEp && stats[node.id]">↓{{bitUnit(stats[node.id]?.receive)}}</span>
														<Status :run="node.online" :tip="timeago(node.heartbeat)"  style="top: 9px;margin-right: 0;"/>
													</div>
													
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