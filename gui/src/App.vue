<template>
	<Toast />
	<ConfirmDialog></ConfirmDialog>
	<router-view />
</template>
<script setup>
import { setAuthorization, AUTH_TYPE } from "@/service/common/request";
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import { useStore } from 'vuex';
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
// import { invoke } from '@tauri-apps/api/core'
// setTimeout(()=>{
// 	invoke('close_splashscreen');
// },1000)
</script>
<style scoped></style>
