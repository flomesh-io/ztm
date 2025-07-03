<script setup>
import { ref, onMounted,onActivated, computed,watch } from "vue";
import { isMobileWidth } from '@/utils/platform';
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
const result = ref(false);
const toggle = ()=>{
	result.value = !result.value;
}
const getResponse = (res) => {
	response.value = res;
	result.value = true;
}

const mobileSctiptShow = ref(false);
const scriptsHide = ref(false)
const hide = () => {
	scriptsHide.value = true;
	mobileSctiptShow.value = false;
}
const show = () => {
	mobileSctiptShow.value = true;
}

const editor = ref();
const setPjs = (s) => {
	editor.value.setPjs(s);
	mobileSctiptShow.value = false;
}
const reloadScripts = () => {
	scriptsHide.value = true;
	setTimeout(()=>{
		scriptsHide.value = false;
	},100)
}

const isMobile = computed(isMobileWidth);

</script>

<template>
	<div class="flex flex-row min-h-screen " >
		<div v-if="!scriptsHide" class="h-full" :class="{'mobile-hidden':(!mobileSctiptShow)}"  style="flex:1">
			<div class="shadow mobile-fixed h-full surface-ground" style="z-index: 100;">
				<Scripts 
					@hide="hide"
					:isMobile="isMobile"
					@edit="setPjs"/>
			</div>
		</div>
		<div class="flex-item h-full shadow" style="flex:3">
			<div class="shadow h-full">
				<Editor :isMobile="isMobile" @show="show" @reload="reloadScripts" ref="editor" v-model:scriptsHide="scriptsHide" v-model:loading="loading" @response="getResponse"/>
			</div>
		</div>
		<div class="flex-item h-full shadow" :class="{'mobile-hidden':(!result)}" :style="scriptsHide?'flex:3':'flex:2'" >
			<div class="shadow mobile-fixed h-full surface-ground" style="z-index: 100;">
				<Result
					:loading="loading"
					:response="response"
					:isMobile="isMobile"
					@back="toggle"/>
			</div>
		</div>
	</div>
</template>

<style scoped lang="scss">
</style>