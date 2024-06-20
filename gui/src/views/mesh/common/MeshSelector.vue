<script setup>
import { ref, onMounted,onActivated, computed,watch } from "vue";
import PipyProxyService from '@/service/PipyProxyService';
import { useStore } from 'vuex';
const store = useStore();
const pipyProxyService = new PipyProxyService();
const selected = ref(null);
const props = defineProps({
	full: {
		type: Boolean,
		default: false
	},
	innerClass: {
		type: String,
		default: 'transparent'
	},
	form: {
		type: Boolean,
		default: false
	},
	modelValue: {
		type: String,
		default: ()=> null
	}
	
});
const emits = defineEmits(['select','update:modelValue']);
onMounted(() => {
	loaddata();
});
onActivated(() => {
	loaddata();
});

const meshes = computed(() => {
	return store.getters['account/meshes'] || []
});
const storeMesh = computed(() => {
	return store.getters["account/selectedMesh"]
});
watch(()=>storeMesh,()=>{
	if(!props.form){
		selected.value = storeMesh.value
	}
},{
	deep:true
})
const loaddata = () => {
	selected.value = props.modelValue || (props.form?meshes.value[0]?.name:meshes.value[0]);
	emits('select',selected.value);
	if(props.form)
	emits('update:modelValue',selected.value);
}


const select = () => {
	emits('select',selected.value);
	if(props.form)
	emits('update:modelValue',selected.value);
}
</script>

<template>
	<Select
		v-if="!props.form"
		v-model="selected" 
		:options="meshes" 
		:filter="meshes.length>10"
		scrollHeight="19rem"
		optionLabel="name" 
		@change="select"
		placeholder="Mesh" 
		class="w-full"
		:class="innerClass">
				<template #option="slotProps">
						<div class="flex align-items-center">
								<Status :run="slotProps.option.connected" :errors="slotProps.option.errors" />
								<div>{{ decodeURI(slotProps.option.name) }}</div>
						</div>
				</template>
				<template #dropdownicon>
					<span></span>
				</template>
				 <template #value="slotProps">
					 <div class="topbar-mesh-select">
						 <div class="topbar-mesh-select-cell" >
							 <div class="mb-1" v-if="slotProps.value">
								<Status style="margin-right: 0 !important;"  :run="slotProps.value.connected" :errors="slotProps.value.errors" />
							 </div>
							 <div v-else class="pi pi-arrow-right-arrow-left"></div>
							 <div v-if="slotProps.value"  v-tooltip.right="decodeURI(slotProps.value.name)">
								<b class="text-ellipsis w-4rem text-sm">{{ decodeURI(slotProps.value.name) }}</b>
							 </div>
							 <div v-else>
									{{ slotProps.placeholder }}
							 </div>
						 </div>
					 </div>
					</template>
		</Select>
		
	<Select
		v-else
		v-model="selected" 
		:options="meshes" 
		optionLabel="name" 
		optionValue="name" 
		scrollHeight="19rem"
		:filter="meshes.length>10"
		@change="select"
		placeholder="Mesh" 
		:style="full?'':'max-width: 300px;'"
		:class="innerClass">
				<template #option="slotProps">
						<div class="flex align-items-center">
								<Status :run="slotProps.option.connected" :errors="slotProps.option.errors" />
								<div>{{ decodeURI(slotProps.option.name) }}</div>
						</div>
				</template>
				 <template #value="slotProps">
							<div v-if="slotProps.value" class="flex align-items-center">
								<div>{{ decodeURI(slotProps.value) }}</div>
							</div>
							<span v-else>
									{{ slotProps.placeholder }}
							</span>
					</template>
		</Select>
</template>

<style scoped lang="scss">
	.topbar-mesh-select{
		display: table;
		width: 100%;
	}
	.topbar-mesh-select-cell{
		height: 40px;
		display: table-cell;
		vertical-align: middle;
		width: 100%;
	}
</style>