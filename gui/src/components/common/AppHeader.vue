<script setup>
import { ref, computed } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router'
const props = defineProps(['main','back'])
const store = useStore();
const router = useRouter();
const isChat = computed(() => store.getters['account/isChat']);

const back = () => {
	if(!!props.back){
		props.back();
	}else{
		router.go(-1);
	}
}

const toggleLeft = () => {
	store.commit('account/setMobileLeftbar', !store.getters['account/mobileLeftbar']);
}
const home = () => {
	router.push("/mesh/list");
}
const windowWidth = computed(() => window.innerWidth);
const isMobile = computed(() => windowWidth.value<=768);
</script>

<template>
	<Toolbar class="nopd-header">
			<template #start>
					<Button v-if="props.main && isMobile" @click.stop="toggleLeft" class="mobile-show" icon="pi pi-bars"  text  />
					<Button v-else-if="props.main && !isMobile" @click="home" icon="pi pi-home" text />
					<Button v-else @click="back" icon="pi pi-angle-left" severity="secondary" text />
					
			</template>
	
			<template #center>
				<slot name="center"/>
			</template>
	
			<template #end> 
				<slot name="end"/>
			</template>
	</Toolbar>
   
</template>

<style scoped lang="scss">
</style>
