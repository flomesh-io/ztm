<script setup>
import { ref } from "vue";
import Empty from "@/assets/img/empty.png";
const props = defineProps({
	title: {
		type: String,
		default: ''
	},
	sub: {
		type: String,
		default: ''
	},
});
</script>
<template>
    <div class="w-full text-center py-8">
				<img :src="Empty"/>
        <h5 class="text-gray-400">{{props.title||'暂无数据'}}</h5>
        <p>{{props.sub}}</p>
    </div>
</template>