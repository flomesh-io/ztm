<script setup>
import { ref, computed, watch } from 'vue';
const props = defineProps(['obj','k']);
const emits = defineEmits(['update:obj'])
const inputVal = ref(false);
const isEdit = ref(false);

const args = computed(() => {
	try{
		return JSON.parse(props.obj?.arguments);
	}catch(e){
		return {}
	}
})
const inputType = ref('string');
const editVal = () => {
	isEdit.value = true;
	inputType.value = typeof(args.value[props.k]);
	if(inputType.value == 'string'){
		inputVal.value = args.value[props.k];
	} else {
		inputVal.value = JSON.stringify(args.value[props.k])
	}
}
const enterVal = () => {
	const _args = args.value;
	if(inputType.value == 'string'){
		_args[props.k] = inputVal.value;
	} else {
		_args[props.k] = JSON.parse(inputVal.value);
	}
	isEdit.value = false;
	emits('update:obj', {
		...props.obj,
		arguments: JSON.stringify(_args)
	})
}
</script>

<template>
	<Tag class="pointer" @click="editVal" size="small" v-if="!isEdit" severity="secondary">
		<i class="pi pi-pencil vm mr-2 text-sm opacity-70"/>
		{{args[props.k]}}
	</Tag>
	<Tag size="small" v-else severity="secondary">
		<i  @click="enterVal" class="pi pi-times opacity-70 pointer"/>
		<input style="background-color: transparent;border-style: none none solid none; border-width: 1px;border-color: #aaa;outline:none" @keyup.enter="enterVal" type="text" v-model="inputVal"/>
		<i  @click="isEdit = false" class="pi pi-check opacity-70 pointer"/>
	</Tag>
</template>

<style scoped lang="scss">
</style>