<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import { platform } from '@/utils/platform';
import toast from "@/utils/toast";
import { useI18n } from 'vue-i18n';
import ZtmService from '@/service/ZtmService';

const { t } = useI18n();
const ztmService = new ZtmService();
const props = defineProps(['multiple','modelValue','mesh','disabled','app','endpoint','size','class','user']);
const emits = defineEmits(['select','update:modelValue']);

const endpoints = ref([]);
const loading = ref(false)
const filter = ref({
	keyword:'',
	limit:100,
	offset:0
})
const currentEp = computed(()=>{
	if(!!props.app){
		return props.endpoint
	}else{
		return props.mesh?.agent
	}
})
const getEndpoints = (callback) => {
	loading.value = true;
	if(!filter.value.keyword && endpoints.value.length == 0 && props.mesh){
		endpoints.value = [currentEp.value]
	}
	ztmService.getEndpoints(props.mesh?.name,{
		...filter.value,
		user:props.user
	})
		.then(res => {
			endpoints.value = res || [];
			loading.value = false;
		})
		.catch(err => {
			loading.value = false;
		}); 
}
const selectEndpoints = ref([]);
const selectEndpoint = ref();
const select = () => {
	if(!!props.multiple){
		emits('select',selectEndpoints.value);
		emits('update:modelValue',selectEndpoints.value);
	} else {
		emits('select',selectEndpoint.value);
		emits('update:modelValue',selectEndpoint.value);
	}
}
const selectFilter = (v) => {
	filter.value.keyword = v?.value||"";
	getEndpoints();
}
watch(()=>props.modelValue,()=>{
	if(props.modelValue){
		if(!!props.multiple){
			selectEndpoints.value = props.modelValue
		}else{
			selectEndpoint.value = props.modelValue
		}
	}
},{deep:true,immediate:true});
onMounted(()=>{
	getEndpoints();
})
</script>

<template>
	<MultiSelect 
		v-if="props.multiple" 
		@filter="selectFilter" 
		:size="props.size"
		:disabled="!!props.disabled"
		maxSelectedLabels="2" 
		:loading="loading"  
		:emptyMessage="t('No Endpoint')"
		v-model="selectEndpoints" 
		@change="select" 
		:options="endpoints" 
		optionLabel="name" 
		:class="props.class"
		optionValue="id" 
		:filter="true" 
		:placeholder="t('Endpoints')"
	  :selectedItemsLabel="`${selectEndpoints.length} ${t('Endpoints')}`" 
		style="max-width: 200px;" >
		<template #option="slotProps">
			<i class="pi pi-mobile mr-1"/>
			{{ slotProps.option?.name }}
			<Tag v-if="currentEp?.id == slotProps.option?.id" :value="t('Local')" class="ml-2" severity="contrast"/>
		</template>
	</MultiSelect>
	<Select
		v-else
		:disabled="!!props.disabled"
		v-model="selectEndpoint"  
		:size="props.size"
		@change="select" 
		:emptyMessage="t('No Endpoint')"
		:options="endpoints" 
		@filter="selectFilter" 
		:loading="loading"  
		optionLabel="name" 
		optionValue="id"
		:placeholder="t('Endpoint')" 
		:class="props.class">
			<template #option="slotProps">
				<i class="pi pi-mobile mr-1"/>
				{{ slotProps.option?.name }}
				<Tag v-if="currentEp?.id == slotProps.option?.id" :value="t('Local')" class="ml-2" severity="contrast"/>
			</template>
	</Select>
</template>

<style scoped lang="scss">
</style>