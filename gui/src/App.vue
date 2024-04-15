<script setup>
//pass login
import { setAuthorization, AUTH_TYPE } from "@/service/common/request";
import store from "@/store";
setAuthorization({
	token: "pass",
	expireAt: 7
}, AUTH_TYPE.BASIC);
store.commit('account/setUser', {id:'Client'});
	// import { invoke } from '@tauri-apps/api/core'
	// setTimeout(()=>{
	// 	invoke('close_splashscreen');
	// },1000)
	
	// {
	// 	 "width": 300,
	// 	 "height": 300,
	// 	 "decorations": false,
	// 	 "url": "splashscreen.html",
	// 	 "label": "splashscreen"
	// },
</script>

<template>
	<Toast />
	<router-view />
</template>

<style scoped></style>
