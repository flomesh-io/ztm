<script setup>
import { ref, onMounted,onActivated, computed,watch } from "vue";
import Outbounds from './Outbounds.vue'
import OutboundCreate from './OutboundCreate.vue'
import Inbounds from './Inbounds.vue'

const visibleDialog = ref(false);
const visibleEditor = ref(false);
</script>

<template>
	<div class="flex flex-row min-h-screen" >
		<div class="relative flex-item h-full " >
			<Inbounds/>
		</div>
		<div class="flex-item h-full shadow" >
			<Outbounds @create="() => visibleEditor = true" @edit="(outbound) => {visibleDialog = true;selectedOutbound = outbound}"/>
		</div>
		<div class="flex-item h-full" v-if="!!visibleEditor">
			<div class="shadow mobile-fixed h-full">
				<OutboundCreate
					title="New Outbound" 
					:mesh="''" 
					:pid="selectedOutbound?.outbound?.name" 
					:ep="selectedOutbound?.ep?.id" 
					:proto="selectedOutbound?.outbound?.protocol"
					@save="save" 
					@back="() => {selectedOutbound=null;visibleEditor=false;}"/>
			</div>
		</div>
	</div>
	<Dialog 
		:showHeader="false" 
		class="nopd transparent"
		v-model:visible="visibleDialog" 
		modal 
		:style="{ width: '100%', maxWidth: '900px', padding: 0 }"
		>
		<InboundMaping 
			@save="savePort" 
			:mesh="''" 
			:endpoint="''" 
			:endpoints="[]"
			:targetEndpoints="[]"
			:proto="selectedOutbound?.outbound?.protocol"
			:outbound="selectedOutbound?.outbound?.name" 
			:outboundPort="selectedOutbound?.outbound?.port"
			:targetEndpoint="selectedOutbound?.ep"/>
	</Dialog>
</template>

<style scoped lang="scss">
</style>