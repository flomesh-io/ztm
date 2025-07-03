<script setup>
import { ref, computed,onActivated,onMounted,useSlots } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router'
import { platform, isPC, isMobileWidth } from '@/utils/platform';
import XeyeSvg from "@/assets/img/logo.png";
const slots = useSlots();
const props = defineProps(['main','back','child'])
const store = useStore();
const router = useRouter();
const hasStartSlot = computed(() => !!slots.start);
const back = () => {
	if(!!props.back){
		props.back();
	}else if(props.child){
		if(window.parent){
			window.parent.location.href="/#/mesh/apps";
		}else{
			location.href="/#/mesh/apps";
		}
	}else{
		router.go(-1);
	}
}

const toggleLeft = () => {
	store.commit('account/setMobileLeftbar', !store.getters['account/mobileLeftbar']);
}
const pm = computed(() => {
	return platform()
});
const hasPC = computed(() => isPC());
const hasTauri = ref(!!window.__TAURI_INTERNALS__);
const home = () => {
	if(hasTauri.value){
		router.push('/mesh/list');
	}else{
		router.push("/mesh/list");
	}
}
const isMobile = ref(isMobileWidth());
onActivated(()=>{
	setTimeout(()=>{
		isMobile.value = isMobileWidth();
	},500)
})
onMounted(()=>{
	setTimeout(()=>{
		isMobile.value = isMobileWidth();
	},500)
})

</script>

<template>
	<div v-if="isMobile" class="empty-header"/>
	<Toolbar class="nopd-header">
			<template #start>
				<slot v-if="hasStartSlot" name="start"/>
				<Button v-else-if="props.main && (isMobile || pm =='android'|| pm =='ios')" @click.stop="toggleLeft" class="mobile-show"   text >
					<img class="logo pointer" :src="XeyeSvg" width="28px" height="28px"/>
				</Button>
				<Button v-else-if="props.main && pm == 'web'" @click="home"  text >
					<svg class="svg text-primary-500 linear" aria-hidden="true">
						<use xlink:href="#svg-home"></use>
					</svg>
				</Button>
				<Button v-else-if="!(props.child && hasPC)" @click="back" icon="pi pi-angle-left" severity="secondary" text />
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
