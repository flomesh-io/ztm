<script setup>
import { ref, computed, onMounted } from 'vue';
import store from "@/store";
import PipySvg from "@/assets/img/pipy-white.png";
import ShellService from '@/service/ShellService';

const shellService = new ShellService();
const restart = ref(false);
const pipyVersion = computed(() => {
	return store.getters['account/pipyVersion']
});

onMounted(() => {
	if(!pipyVersion.value){
		shellService.takePipyVersion();
	}
});
const restartPipy = () => {
	restart.value = true;
	store.commit('account/setPipyVersion', '');
	setTimeout(()=>{
		restart.value = false;
	},1000);
	shellService.takePipyVersion();
}

</script>

<template>
	<div class="pipyinfo">
		<div class="pipystatus">
			<img :src="PipySvg" height="25"/>
			<span v-if="!!pipyVersion" class="label">{{pipyVersion}}</span>
			<a v-else class="label link pointer" href="https://flomesh.io/pipy/download" target="_blank"><b>Download</b></a>
		</div>
		<i class="pi pi-refresh" :class="{'spiner': restart}" @click="restartPipy"/>
	</div>
</template>

<style lang="scss" scoped>
	.pipyinfo{
		display: flex;
	}
	.pipystatus{
		height: 12px;
		border-right: 1px dashed rgba(255, 255, 255, 0.5);
		padding-right: 17px;
		position: relative;
		top: 5px;
	}
	.pipystatus .status-point{
		
		position: relative;
		top: -5px;
	}
	.pipystatus .label{
		vertical-align: middle;
		color: rgba(255, 255, 255, 0.8);
		position: relative;
		top: -6px;
	}
	.pipystatus>img{
		vertical-align: middle;
		margin-right: 8px;
		position: relative;
		top: -5px;
		opacity: 0.9;
	}
	.pipyinfo .pi-refresh{
		color: #fff;
		vertical-align: middle;
		opacity: 0.7;
		cursor: pointer;
		font-size: 18px;
		margin-left: 12px;
		height: 20px;
		position: relative;
		top: 2px;
		transition: all .3s;
	}
	.pipyinfo .pi-refresh:hover{
		opacity: 1;
	}
</style>
