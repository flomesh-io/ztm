<script setup>
import { ref, computed, watch } from 'vue';
import ZtmService from '@/service/ZtmService';

const ztmService = new ZtmService();
const props = defineProps(['endpoint','mesh','app']);
const endpoint = ref({});
const loading = ref(false)

const getEndpoint = (callback) => {
	loading.value = true;
	ztmService.getEndpoint(props.mesh?.name,props.endpoint)
		.then(res => {
			endpoint.value = res || {id:props.endpoint};
			loading.value = false;
		})
		.catch(err => {
			loading.value = false;
		}); 
}
watch(()=>props.endpoint,()=>{
	if(props.endpoint){
		getEndpoint();
	}
},{deep:true,immediate:true});
</script>

<template>
	<span>{{endpoint?.name||'...'}}</span>
</template>

<style scoped lang="scss">
</style>