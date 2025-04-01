<script setup>
import { ref,onMounted,watch, computed } from "vue";
import { useRouter } from 'vue-router'
import ZtmService from '@/service/ZtmService';
import AppService from '@/service/AppService';
import EndpointInfo from './EndpointInfo.vue';
import { useStore } from 'vuex';
import { useConfirm } from "primevue/useconfirm";
import AppManage from '@/views/apps/AppManage.vue';
import { dayjs, extend } from '@/utils/dayjs';
import defaultIcon from "@/assets/img/apps/default.png";
import { useI18n } from 'vue-i18n';
const { t, locale } = useI18n();
extend(locale.value)

const props = defineProps(['ep']);
const emits = defineEmits(['back','reload']);
const store = useStore();
const router = useRouter();
const ztmService = new ZtmService();
const appService = new AppService();
const confirm = useConfirm();
const loading = ref(false);
const loader = ref(false);
const status = ref({});
const endpoints = ref([]);

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

const typing = ref('');

const back = () => {
	emits('back')
}
const go = (path) => {
	router.push(path);
}
const removeEp = () => {
	ztmService.deleteEp(selectedMesh.value?.name, props.ep?.username,() => {
			setTimeout(()=>{
				emits('reload')
				emits('back')
			},300)
		});
}
const meshApps = ref([]);
const detail = ref({})
const loadEp = () => {
	ztmService.getEndpoint(selectedMesh.value?.name, props.ep.id).then((res)=>{
		detail.value = res;
	}).catch((e)=>{
		console.log(e)
	});
}
const loadApps = () => {
	appService.getEpApps(selectedMesh.value?.name, props.ep.id).then((res)=>{
		console.log("start getApps")
		meshApps.value = res?.filter((app) => app.name !='terminal') || [];
		console.log(res);
	}).catch((e)=>{
		console.log(e)
	});
}
onMounted(()=>{
	loadEp();
})
</script>

<template>
	
	<div class="min-h-screen surface-ground relative">
	<AppHeader :back="back">
			<template #center>
				<Status v-if="!!props.ep" :run="props.ep.online" :tip="timeago(props.ep.heartbeat)"  style=""/>
				<b v-if="!!props.ep">{{ props.ep.name|| 'Unknow EP' }} <span v-if="!!props.ep.username">({{props.ep.username}})</span></b>
				<span v-else>Loading...</span>
				
			</template>
	
			<template #end> 
				<span v-if="!!props.ep && props.ep.isLocal" class="mr-2 relative" style="top: -1px;"><Tag severity="contrast" >{{t('Local')}}</Tag></span>
				<Button v-if="selectedMesh?.agent?.username == 'root' && props.ep.username != 'root'" icon="pi pi-trash" severity="danger"  @click="removeEp"/>
			</template>
	</AppHeader>
	<div class="text-center ">
		<TabView class="" v-model:activeIndex="active">
			
			<TabPanel>
				<template #header>
					<div>
						<i class="pi pi-info-circle mr-2" />{{t('Info')}}
					</div>
				</template>
				<EndpointInfo :ep="{...props.ep,...detail}"/>
			</TabPanel>
			<TabPanel>
				<template #header>
					<div >
						<i class="pi pi-objects-column mr-2" />{{t('Apps')}}
					</div>
				</template>
				
				<div class="terminal_body p-4">
					<AppManage
						:meshApps="meshApps" 
						:theme="true" 
						:embedEp="props.ep" 
						@reload="loadApps"/>
				</div>
				
			</TabPanel>
		</TabView>
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
