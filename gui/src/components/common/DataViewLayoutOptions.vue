<script setup>
	import { ref,watch } from "vue";
	const props = defineProps({
			modelValue: {
					type: String,
					default: 'grid'
			},
			
	});
	
	const emits = defineEmits(['update:modelValue']);
	const layout = ref(props.modelValue);
	const options = ref(['list', 'grid']);
	
	watch(()=>{
		return layout.value
	},()=>{
		if(layout.value != props.modelValue)
		change();
	},{
		deep:false
	});
	const change = () => {
		emits("update:modelValue",layout.value);
	}
</script>

<template>
	<SelectButton v-model="layout" :options="options" :allowEmpty="false">
			<template #option="{ option }">
					<i :class="[option === 'list' ? 'pi pi-bars' : 'pi pi-th-large']" />
			</template>
	</SelectButton>
</template>
