<template>
	<div @click="open" class="col-3 py-4 relative text-center">
		<img :src="icon" class="pointer" width="40" height="40" style="border-radius: 4px; overflow: hidden;margin: auto;"/>
		<div class="mt-1">
			<b class="text-white opacity-90">ZTM Log</b>
		</div>
	</div>
</template>

<script setup>
	
import { openWebview } from '@/utils/webview';
import { onMounted, onBeforeUnmount } from 'vue';
import icon from "@/assets/img/apps/ztmlog.png";

const open = () => {
	openWebview({
		url:'/#/app/ztmlog',
		name:'ZtmLog',
		width:455,
		height:350,
		proxy:''
	})
}

</script>
