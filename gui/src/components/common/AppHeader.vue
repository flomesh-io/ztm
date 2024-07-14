<script setup>
import { ref, computed,onActivated,onMounted,useSlots } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router'
const slots = useSlots();
const props = defineProps(['main','back'])
const store = useStore();
const router = useRouter();
const hasStartSlot = computed(() => !!slots.start);
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
const platform = computed(() => {
	return store.getters['account/platform']
});
const hasTauri = ref(!!window.__TAURI_INTERNALS__);
const home = () => {
	if(hasTauri.value){
		router.push('/mesh/list');
	}else{
		router.push("/mesh/list");
	}
}
const windowWidth = ref(window.innerWidth);
const isMobile = computed(() => windowWidth.value<=768);
onActivated(()=>{
	setTimeout(()=>{
		windowWidth.value = window.innerWidth;
	},500)
})
onMounted(()=>{
	setTimeout(()=>{
		windowWidth.value = window.innerWidth;
	},500)
})

</script>

<template>
	<Toolbar class="nopd-header">
			<template #start>
				<slot v-if="hasStartSlot" name="start"/>
				<Button v-else-if="props.main && (isMobile || platform =='android')" @click.stop="toggleLeft" class="mobile-show" icon="pi pi-bars"  text  />
				<Button v-else-if="props.main" @click="home" icon="iconfont icon-home" text />
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
