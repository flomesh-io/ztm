<script setup>
import { ref,onActivated,watch, computed } from "vue";
import { useRouter } from 'vue-router'
import ZtmService from '@/service/ZtmService';
import EndpointInfo from './EndpointInfo.vue';
import { useStore } from 'vuex';
import { useConfirm } from "primevue/useconfirm";
import freeSvg from "@/assets/img/free.svg";
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime)

const props = defineProps(['ep']);
const emits = defineEmits(['back']);
const store = useStore();
const router = useRouter();
const ztmService = new ZtmService();
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
</script>

<template>
	
	<div class="min-h-screen surface-ground">
	<AppHeader :back="back">
			<template #center>
				<Status v-if="!!props.ep" :run="props.ep.online" :tip="timeago(props.ep.heartbeat)"  style=""/>
				<b v-if="!!props.ep">{{ props.ep.name|| 'Unknow EP' }} <span v-if="!!props.ep.username">({{props.ep.username}})</span></b>
				<span v-else>Loading...</span>
				
			</template>
	
			<template #end> 
				<span v-if="!!props.ep" class="mr-2 relative" style="top: -1px;"><Tag severity="contrast" >{{props.ep.isLocal?'Local':'Remote'}}</Tag></span>
			</template>
	</AppHeader>
	<div class="text-center">
		<TabView class="" v-model:activeIndex="active">
			
			<TabPanel>
				<template #header>
					<div>
						<i class="pi pi-info-circle mr-2" />Info
					</div>
				</template>
				<EndpointInfo :ep="props.ep"/>
			</TabPanel>
			<TabPanel>
				<template #header>
					<div>
						<i class="pi pi-server mr-2" />Apps
					</div>
				</template>
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
