<template>
	<div @click="open" class="col-3 py-4 relative text-center">
		<img :src="icon" class="pointer" width="40" height="40" style="border-radius: 4px; overflow: hidden;margin: auto;"/>
		<div class="mt-1">
			<b class="text-white opacity-90">App Store</b>
		</div>
	</div>
</template>

<script setup>
	
import { openWebview } from '@/utils/webview';
import { onMounted, onBeforeUnmount } from 'vue';
import icon from "@/assets/img/apps/appstore.png";
const open = () => {
	openWebview({
		url:'/#/store/apps',
		name:'Console',
		width:1280,
		height:860,
		proxy:''
	})
}

</script>
