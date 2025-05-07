<script setup>
import { ref, onMounted,onActivated, computed,watch } from "vue";
import Setting from './Setting.vue'

const visibleEditor = ref(false);
const loading = ref(false);
const loader = ref(false);
const error = ref();
</script>

<template>
	<div class="flex flex-row min-h-screen" >
		<div class="flex-item h-full">
			<div class="h-full">
				<Setting />
			</div>
		</div>
	</div>
</template>

<style scoped lang="scss">
</style>