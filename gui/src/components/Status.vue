<script setup>
import { ref, computed } from "vue";
const props = defineProps({
	run: {
		type: Boolean,
		default: false
	},
	tip: {
		type: String,
		default: ''
	},
	errors: {
		type: Array,
		default: () => []
	},
	text: {
		type: String,
		default: null
	},
	style: {
		type: String,
		default: ''
	},
});
const errorMsg = computed(() => {
	let msg = props.tip;
	if(!!msg){
		msg += '\n';
	}
	props.errors.forEach((error, ei) => {
		if(ei>0){
			msg += '\n';
		}
		msg += `[${error.time}] ${error.message}`;
	});
	return msg;
})

</script>

<template>
	<div :style="style" v-if="props.run && !!props.text && !!props.tip" v-tooltip="{value:props.tip,pt:{text:'w-20rem'}}" class="text-900 font-medium text-xl pointer">
		<span class="status-point mr-2 relative run" style="top: -2px;"/> 
		<span >{{props.text}}</span>
	</div>
	<div :style="style" v-else-if="props.run && !!props.text" class="text-900 font-medium text-xl pointer">
		<span class="status-point mr-2 relative run" style="top: -2px;"/> 
		<span >{{props.text}}</span>
	</div>
	<div :style="style" v-else-if="!props.run && !!props.text" v-tooltip="{value:errorMsg,pt:{text:'w-30rem'}}" class="text-900 font-medium text-xl pointer">
		<span class="status-point mr-2 relative " style="top: -2px;"/> 
		<span class="text-gray-400" >{{props.text}}</span>
	</div>
	<span :style="style" v-else-if="props.run && !!props.tip" v-tooltip="{value:props.tip,pt:{text:'w-20rem'}}" class="status-point mr-3 relative run" />
	<span :style="style" v-else-if="props.run" class="status-point mr-3 relative run" />
	<span :style="style" v-else  v-tooltip="{value:errorMsg,pt:{text:'w-20rem'}}"  class="status-point mr-3 relative " /> 
</template>

<style scoped lang="scss">
</style>