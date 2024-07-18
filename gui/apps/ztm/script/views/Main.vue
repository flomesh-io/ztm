<script setup>
import { ref, onMounted,onActivated, computed,watch } from "vue";
import Scripts from './Scripts.vue'
import Editor from './Editor.vue'
import Result from './Result.vue'

onMounted(()=>{
	loaddata()
})
const loaddata = () => {
}
const loading = ref(false);
const response = ref({});
const selectedScript = ref();
const layout = ref('list');
const toggle = ()=>{
	layout.value = layout.value == 'list'?'result':'list'
}
const getResponse = (res) => {
	response.value = res;
	layout.value = "result";
}
const scriptsHide = ref(false)
const hide = () => {
	scriptsHide.value = true;
}
const editor = ref();
const setPjs = (s) => {
	editor.value.setPjs(s);
}
const reloadScripts = () => {
	scriptsHide.value = true;
	setTimeout(()=>{
		scriptsHide.value = false;
	},100)
}
</script>

<template>
	<div class="flex flex-row min-h-screen" >
		<div v-if="!scriptsHide" class="h-full "  style="flex:1">
			<Scripts 
				@hide="hide"
				@edit="setPjs"/>
		</div>
		<div class="flex-item h-full shadow" style="flex:3">
			<div class="shadow mobile-fixed h-full">
				<Editor @reload="reloadScripts" ref="editor" v-model:scriptsHide="scriptsHide" v-model:loading="loading" @response="getResponse"/>
			</div>
		</div>
		<div class="flex-item h-full shadow" :style="scriptsHide?'flex:3':'flex:2'" >
			<div class="shadow mobile-fixed h-full">
				<Result
					:loading="loading"
					:response="response"
					@back="toggle"/>
			</div>
		</div>
	</div>
</template>

<style scoped lang="scss">
</style>