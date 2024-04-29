<script setup>
import { ref, onMounted,onActivated, computed } from "vue";
import { useRouter } from 'vue-router'
import PipyProxyService from '@/service/PipyProxyService';
import MeshSelector from './common/MeshSelector.vue'
import store from "@/store";
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
const logs = ref([])
const selectedMesh = ref(null);

const meshes = computed(() => {
	return store.getters['account/meshes']
});

const load = (d) => {
	meshes.value = d;
}
onActivated(()=>{
	getLogs();
})
const select = (selected) => {
	selectedMesh.value = selected;
	getLogs();
}

const getLogs = () => {
	loading.value = true;
	loader.value = true;
	pipyProxyService.getLogs(selectedMesh.value?.name)
		.then(res => {
			loading.value = false;
			setTimeout(() => {
				loader.value = false;
			},2000)
			logs.value = res || [];
		})
		.catch(err => {
			loading.value = false;
			loader.value = false;
		}); 
}
const typing = ref('');
const logsFilter = computed(() => {
	return logs.value.filter((log)=>{
		return (typing.value == '' || log.message.indexOf(typing.value) >=0  || typing.value == log.type);
	})
});
const clickSearch = () => {
}
const active = ref(0);
const severityMap = computed(() => (severity) => {
	if(severity == 'error'){
		return "danger";
	} else if(severity == 'warn'){
		return "warning";
	} else if(severity == 'debug'){
		return "contrast";
	} else {
		return severity;
	}
})
const timeago = computed(() => (ts) => {
	if(!!ts){
		const date = new Date(ts);
		return dayjs(date).fromNow();
	} else {
		return "None";
	}
})

</script>

<template>
	<Card class="nopd ml-3 mr-3 mt-3">
		<template #content>
			<InputGroup class="search-bar" >
				<MeshSelector
					:full="false" 
					innerClass="transparent" 
					@load="load" 
					@select="select"/>
				<Textarea @keyup="watchEnter" v-model="typing" :autoResize="true" class="drak-input bg-gray-900 text-white" placeholder="Type service | port" rows="1" cols="30" />
				<Button :disabled="!typing" icon="pi pi-search"  @click="clickSearch"/>
			</InputGroup>
		</template>
	</Card>
	
	<TabView class="pt-3 pl-3 pr-3" v-model:activeIndex="active">
		<TabPanel>
			<template #header>
				<div>
					<i class="pi pi-book mr-2"/> Logs
					<i @click="getPorts" class="pi pi-refresh ml-2 refresh-icon" :class="{'spiner':loader}"/>
				</div>
			</template>
			<Loading v-if="loading"/>
			<div v-else class="text-center">
				<div class="grid text-left" v-if="logsFilter && logsFilter.length >0">
					<DataTable class="w-full" :value="logsFilter" tableStyle="min-width: 50rem">
						
						<Column header="Time">
							<template #body="slotProps">
								{{timeago(slotProps.data.time)}}
							</template>
						</Column>
						
						<Column header="Type">
							<template #body="slotProps">
								<Tag :severity="severityMap(slotProps.data.type)">{{slotProps.data.type}}</Tag>
							</template>
						</Column>
						
						<Column header="Message">
							<template #body="slotProps">
								{{slotProps.data.message}}
							</template>
						</Column>
					</DataTable>
				</div>
				<img v-else :src="freeSvg" class="w-5 h-5 mx-aut" style="margin: auto;"  />
			</div>
		</TabPanel>
	</TabView>
</template>

<style scoped lang="scss">
:deep(.p-dataview-content) {
  background-color: transparent !important;
}
.drak-input{
	border: none;
	min-height: 33px !important;
}
:deep(.p-tabview-nav),
:deep(.p-tabview-panels),
:deep(.p-tabview-nav-link){
	background: transparent !important;
}
</style>