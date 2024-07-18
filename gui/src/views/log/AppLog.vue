<script setup>
import { ref, onMounted,onActivated,watch, computed } from "vue";
import { useRouter, useRoute } from 'vue-router'
import AppService from '@/service/AppService';
import { useStore } from 'vuex';
import { useConfirm } from "primevue/useconfirm";
import _ from 'lodash';
import Log from './Log.vue'

const store = useStore();
const route = useRoute();
const router = useRouter();
const appService = new AppService();
const confirm = useConfirm();
const loading = ref(false);
const loader = ref(false);
const logs = ref([])
const loaddata = () => {
	loading.value = true;
	loader.value = true;
	getLogs();
}
const params = ref({})
const getLogs = (ep) => {
	params.value = route?.params || {};
	appService.getAppLog({
		mesh:params.value?.mesh,
		ep:params.value?.ep,
		provider:params.value?.provider||'ztm',
		app:params.value?.app,
	}).then(res => {
			loading.value = false;
			setTimeout(() => {
				loader.value = false;
			},2000)
			const _res = res;
			_res.forEach(item => item.ep = ep);
			logs.value = res || [];
			logs.value  = _.uniqBy(logs.value, item => `${item?.ep||item?.app}-${item.time}-${item.message}`);
			logs.value = _.sortBy(logs.value, item => item.time).reverse();
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
const back = () => {
	router.go(-1)
}
onMounted(()=>{
	loaddata();
})
</script>

<template>
	<Card class="nopd">
		<template #content>
			<InputGroup class="search-bar" >
				<Button icon="pi pi-search" :label="`${params?.mesh}/${params?.provider}/${params?.app}`"/>
				<Textarea @keyup="watchEnter" v-model="typing" :autoResize="true" class="drak-input bg-gray-900 text-white flex-1" placeholder="Type keyword" rows="1" cols="30" />
				<Button icon="pi pi-refresh" @click="loaddata"  :loading="loading"/>
			</InputGroup>
		</template>
	</Card>
	<Loading v-if="loading"/>
	<div v-else-if="logsFilter && logsFilter.length >0" class="text-center">
		<div class="grid text-left px-3 py-3" >
			<Log :d="logsFilter"/>
		</div>
	</div>
	<Empty v-else />
</template>
