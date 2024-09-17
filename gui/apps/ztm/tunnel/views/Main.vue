<script setup>
import { ref, onMounted,onActivated, computed,watch } from "vue";
import Tunnels from './Tunnels.vue'
import TunnelEditor from './TunnelEditor.vue'
import TunnelService from '../service/TunnelService';

const visibleEditor = ref(false);
const tunnelService = new TunnelService();
const save = (tunnel) => {
	loaddata(tunnel);
}
const endpointMap = ref({});
onMounted(()=>{
	loaddata()
})
const loaddata = (tunnel) => {
	getTunnels(tunnel);
}
const selectedTunnel = ref();
const loading = ref(false);
const loader = ref(false);
const error = ref();
const tunnels = ref([]);
const getTunnels = (tunnel) => {
	loading.value = true;
	loader.value = true;
	endpointMap.value = {};
	tunnelService.getTunnels((_tunnels,_eps)=>{
		console.log("tunnels:")
		console.log(_tunnels)
		loading.value = false;
		setTimeout(() => {
			loader.value = false;
		},2000)
		error.value = null;
		tunnels.value = _tunnels || [];
		_eps.forEach((ep) => {
			endpointMap.value[ep.id] = ep;
		})
		if(!!tunnel){
			const _find = tunnels.value.find((_t) => _t.name == tunnel.name && _t.proto == tunnel.proto)
			if(!!_find){
				selectedTunnel.value = _find;
				visibleEditor.value = true;
			} else {
				selectedTunnel.value = null;
				visibleEditor.value = false;
			}
		}
	},()=>{
		alert(2)
		loading.value = false;
		loader.value = false;
	});
}
</script>

<template>
	<div class="flex flex-row min-h-screen" >
		<div class="h-full" :class="{'w-24rem':(!!visibleEditor),'flex-item':(!visibleEditor),'mobile-hidden':(!!visibleEditor)}">
			<Tunnels 
				:tunnels="tunnels" 
				:error="error" 
				:loading="loading"
				:loader="loader"
				:small="visibleEditor" 
				@create="() => visibleEditor = true" 
				@load="loaddata"
				@edit="(tunnel) => {visibleEditor = true;selectedTunnel = tunnel}"/>
		</div>
		<div class="flex-item h-full shadow" v-if="!!visibleEditor">
			<div class="mobile-fixed h-full">
				<TunnelEditor
					:title="selectedTunnel?`${selectedTunnel?.proto}/${selectedTunnel?.name}`:null"
					:d="selectedTunnel" 
					:endpointMap="endpointMap"
					@save="save" 
					@back="() => {selectedTunnel=null;visibleEditor=false;}"/>
			</div>
		</div>
	</div>
</template>

<style scoped lang="scss">
</style>