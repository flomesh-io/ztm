<template>
	<Toast />
	<ConfirmDialog></ConfirmDialog>
	<router-view />
	<WatchShared v-model:open="open" v-model:paths="paths" />
</template>
<script setup>
import { onMounted, ref, computed } from "vue";
import { setAuthorization, AUTH_TYPE } from "@/service/common/request";
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import { useStore } from 'vuex';
import { AcceptFile } from "@/doms/AcceptFile";
import { reg } from "@/utils/notification";
import { getShared } from '@/utils/file';
import { isMobile } from '@/utils/platform';
import { useI18n } from 'vue-i18n';
const { t, locale } = useI18n(); 
const store = useStore();
const toast = useToast();
const confirm = useConfirm();
setAuthorization({
	token: "pass",
	expireAt: 7
}, AUTH_TYPE.BASIC);
store.commit('account/setUser', {id:''});
store.commit('notice/setToast', toast);
store.commit('notice/setConfirm', confirm);

const selectedMesh = computed(() => {
	return store.getters["account/selectedMesh"]
});

const open = ref(false);
const paths = ref()
const timmer = () => {
	store.dispatch('notice/rooms');
	if(!paths.value && isMobile()){
		getShared(false, (res)=>{
			if(res && res.length>0){
				open.value = true;
				paths.value = res;
			}
		})
	}
	setTimeout(()=>{
		timmer();
	},1000)
}
onMounted(()=>{
	reg();
	timmer();
	customElements.define('accept-file', AcceptFile);
})



const changeLanguage = (lang) => {
	locale.value = lang;
};

</script>
<style scoped></style>
