<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useStore } from 'vuex';
import Apps from '@/views/apps/Apps.vue';
const store = useStore();
const router = useRouter();

const go = (path) => {
	router.push(path);
}
const isTauri = ref(!!window.__TAURI_INTERNALS__ );
</script>

<template>
	<div class="relative min-h-screen">
		<Apps layout="absolute_container" :noInners="!isTauri"/>
	</div>
</template>
