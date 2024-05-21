<script setup>
import { ref } from "vue";
import freeSvg from "@/assets/img/free.svg";
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
    <div class="w-full text-center empty-result">
				<img :src="freeSvg" class="w-4 h-4 mx-aut" style="margin: auto;"  />
        <h5 class="text-tip">{{props.title||'No data.'}}</h5>
        <p>{{props.sub}}</p>
    </div>
</template>