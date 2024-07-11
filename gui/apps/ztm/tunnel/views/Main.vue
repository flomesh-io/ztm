<script setup>
import { ref, onMounted,onActivated, computed,watch } from "vue";
import Services from './Services.vue'
import Ports from './Ports.vue'
</script>

<template>
	<div class="flex flex-row min-h-screen" >
		<div  class="relative h-full" >
			<Services/>
		</div>
		<div class="flex-item h-full">
			<Ports/>
		</div>
	</div>
</template>

<style scoped lang="scss">
</style>