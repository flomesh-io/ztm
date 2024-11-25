<script setup>
import { ref } from "vue";
import freeSvg from "@/assets/img/free.svg";
import accessSvg from "@/assets/img/asset-access.svg";
import errorSvg from "@/assets/img/asset-error.svg";
const props = defineProps({
	error: {
		type: Object,
		default: () => {}
	},
	title: {
		type: String,
		default: ''
	},
	sub: {
		type: String,
		default: ''
	},
	button: {
		type: String,
		default: ''
	},
	cancelButton: {
		type: String,
		default: ''
	},
});
const emits = defineEmits(['primary','cancel']);
const primary = () => {
	emits('primary')
}
const cancel = () => {
	emits('cancel')
}
</script>
<template>
    <div v-if="props.error?.status == 403 || props.error?.response?.status == 403" class="w-full text-center empty-result mt-4">
				<img :src="accessSvg" class="w-4 h-4 mx-aut" style="margin: auto;"  />
        <h5 class="text-tip">Forbidden</h5>
				<p>Request failed with status code 403</p>
    </div>
    <div v-else-if="props.error?.status >= 400 || props.error?.response?.status >= 400" class="w-full text-center empty-result mt-4">
				<img :src="errorSvg" class="w-4 h-4 mx-aut" style="margin: auto;"  />
        <h5 class="text-tip">({{props.error?.status || props.error?.response?.status}}) {{props.error?.statusText||props.error?.response?.statusText||"Error"}}</h5>
        <p>{{props.error?.message}}</p>
    </div>
    <div v-else class="w-full text-center empty-result mt-4 relative">
				<img :src="freeSvg" class="w-4 h-4 mx-aut" style="margin: auto;max-width: 400px;"  />
				<h5 class="text-tip">{{props.title||'No data.'}}</h5>
        <p>{{props.sub}}</p>
				<div>
				<Button 
					v-if="props.cancelButton"
					class="empty-btn mr-2"
					:label="props.cancelButton" 
					size="large"
					variant="outlined" 
					outlined
					v-ripple
					severity="primary"
					@click="cancel"/>
				<Button 
					v-if="props.button"
					class="empty-btn"
					:label="props.button" 
					size="large"
					v-ripple
					severity="primary"
					@click="primary"/>
				</div>
    </div>
</template>