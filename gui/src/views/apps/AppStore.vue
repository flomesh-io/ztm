<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useStore } from 'vuex';
import Apps from '@/views/apps/Apps.vue';
const route = useRoute();
const store = useStore();
const router = useRouter();

const go = (path) => {
	router.push(path);
}
const isTauri = ref(!!window.__TAURI_INTERNALS__ );

onMounted(()=>{
	window.addEventListener('popstate', () => {
		setTimeout(()=>{
			store.commit('notice/setApp', null);
		},100)
	});
})
</script>

<template>
	<div class="relative min-h-screen">
		<Apps layout="absolute_container" :noInners="!isTauri"/>
	</div>
</template>
