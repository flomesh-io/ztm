<template>
	<div @click="open" class="col-3 py-4 relative text-center">
		<img :src="icon" class="pointer" width="40" height="40" style="border-radius: 4px; overflow: hidden;margin: auto;"/>
		<div class="mt-1">
			<b class="text-white opacity-90">ZTM Cli</b>
		</div>
	</div>
</template>

<script setup>
	
import { openWebview } from '@/utils/webview';
import { onMounted, onBeforeUnmount } from 'vue';
import icon from "@/assets/img/apps/terminal.png";

const open = () => {
	openWebview({
		url:'/#/app/term',
		name:'Terminal',
		width:455,
		height:350,
		proxy:''
	})
}

</script>
