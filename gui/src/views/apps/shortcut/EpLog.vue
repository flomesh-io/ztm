<template>
	<div @click="open" class="col-3 py-4 relative text-center">
		<img :src="icon" class="pointer" width="40" height="40" style="border-radius: 4px; overflow: hidden;margin: auto;"/>
		<div class="mt-1">
			<b class="text-white opacity-90">EP Log</b>
		</div>
	</div>
</template>

<script setup>
	
import { openWebview } from '@/utils/webview';
import { onMounted, onBeforeUnmount } from 'vue';
import icon from "@/assets/img/apps/eplog.png";
const open = () => {
	openWebview({
		url:'/#/mesh/log',
		name:'Console',
		width:1280,
		height:860,
		proxy:''
	})
}

</script>
