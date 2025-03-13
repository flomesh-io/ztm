<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import { platform } from '@/utils/platform';
import toast from "@/utils/toast";
import { useI18n } from 'vue-i18n';
import ZtmService from '@/service/ZtmService';

const { t } = useI18n();
const ztmService = new ZtmService();
const props = defineProps(['multiple','modelValue','mesh']);
const emits = defineEmits(['select','update:modelValue']);

const endpoints = ref([]);
const loading = ref(false)
const filter = ref({
	keyword:'',
	limit:100,
	offset:0
})
const getEndpoints = (callback) => {
	loading.value = true;
	if(!filter.value.keyword && endpoints.value.length == 0 && props.mesh){
		endpoints.value = [props.mesh.agent]
	}
	ztmService.getEndpoints(props.mesh?.name,filter.value)
		.then(res => {
			endpoints.value = res || [];
			loading.value = false;
		})
		.catch(err => {
			loading.value = false;
		}); 
}
const selectEndpoints = ref([]);
const select = () => {
	emits('select',selectEndpoints.value);
	emits('update:value',selectEndpoints.value);
}

const selectFilter = (v) => {
	selectEndpoints.value = [];
	select();
	filter.value.keyword = v?.value||"";
	getEndpoints();
}
watch(()=>props.modelValue,()=>{
	if(props.modelValue){
		selectEndpoints.value = props.modelValue
	}
},{deep:true,immediate:true});
onMounted(()=>{
	getEndpoints();
})
</script>

<template>
	
	<MultiSelect @filter="selectFilter" maxSelectedLabels="2" :loading="loading"  v-model="selectEndpoints" @change="select" :options="endpoints" optionLabel="name" optionValue="id" :filter="true" :placeholder="t('Endpoints')"
	            :selectedItemsLabel="`${selectEndpoints.length} ${t('Endpoints')}`" style="max-width: 200px;" />
</template>

<style scoped lang="scss">
</style>