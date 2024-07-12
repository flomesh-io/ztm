<script setup>
import { ref, onMounted,onActivated, computed,watch } from "vue";
import Tunnels from './Tunnels.vue'
import TunnelCreate from './TunnelCreate.vue'

const visibleDialog = ref(false);
const visibleEditor = ref(false);
</script>

<template>
	<div class="flex flex-row min-h-screen" >
		<div class="flex-item h-full shadow" >
			<Tunnels @create="() => visibleEditor = true" @edit="(tunnel) => {visibleDialog = true;selectedTunnel = tunnel}"/>
		</div>
		<div class="flex-item h-full" v-if="!!visibleEditor">
			<div class="shadow mobile-fixed h-full">
				<TunnelCreate
					:mesh="''" 
					:pid="selectedTunnel??.name" 
					:ep="selectedTunnel?.ep?.id" 
					:proto="selectedTunnel??.protocol"
					@save="save" 
					@back="() => {selectedTunnel=null;visibleEditor=false;}"/>
			</div>
		</div>
	</div>
</template>

<style scoped lang="scss">
</style>