<template>
	<Toast />
	<ConfirmDialog></ConfirmDialog>
	<router-view />
</template>
<script setup>
import { onMounted, ref, computed } from "vue";
import { setAuthorization, AUTH_TYPE } from "@/service/common/request";
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import { useStore } from 'vuex';
import { AcceptFile } from "@/doms/AcceptFile";
import { reg } from "@/utils/notification";
import { getSharedFiles } from '@/utils/file';
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
const sharedTimer = ref(true)
const timmer = () => {
	store.dispatch('notice/rooms');
	if(sharedTimer.value){
		getSharedFiles(false, (paths)=>{
			if(paths && paths.length>0){
				sharedTimer.value = false;
				getSharedFiles(true, (files)=>{
					if(files && files.length>0){
						sharedTimer.value = true;
					}
				})
			}
		})
	}
	setTimeout(()=>{
		timmer();
	},1000)
}
onMounted(()=>{
	reg();
	timmer()
	customElements.define('accept-file', AcceptFile);
})
</script>
<style scoped></style>
