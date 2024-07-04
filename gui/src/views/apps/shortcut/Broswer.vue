<script setup>
import { ref, computed } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import AppService from '@/service/AppService';
import PipyProxyService from '@/service/PipyProxyService';
import MeshSelector from '@/views/mesh/common/MeshSelector.vue'
import { openWebview } from '@/utils/webview';
import icon from "@/assets/img/apps/broswer.png";

const router = useRouter();
const store = useStore();
const appService = new AppService();
const emits = defineEmits(['open','close'])
const pipyProxyService = new PipyProxyService();
const broswer = ref({
	mesh:null,
	show:false,
	url:'',
	port:null,
	ports:[]
});
const openBroswer = () => {
	broswer.value.show = true;
	emits('open')
	pipyProxyService.getMeshes()
		.then(res => {
			store.commit('account/setMeshes', res);
		})
		.catch(err => console.log('Request Failed', err)); 
}
const closeBroswer = () => {
	broswer.value.show = false;
	emits('close');
}
const open = () => {
	openWebview({
		...broswer.value,
		proxy: !!broswer.value.port?`socks5://${broswer.value.port?.listen?.ip||'127.0.0.1'}:${broswer.value.port?.listen?.port}`:''
	})
}
const getPorts = (mesh) => {
	broswer.value.mesh = mesh;
	if(!broswer.value?.mesh?.name){
		return
	}
	pipyProxyService.getPorts({
		mesh:broswer.value?.mesh?.name,
		ep:broswer.value?.mesh?.agent?.id,
	})
		.then(res => {
			console.log(res)
			broswer.value.ports = res || [];
			broswer.value.ports.forEach((p)=>{
				p.id = p.listen.port;
				p.name = p.listen.port;
			})
		})
		.catch(err => {
		}); 
}
</script>

<template>
	<div v-if="!broswer.show" @click="openBroswer" class="col-3 py-4 relative text-center">
		<img :src="icon" class="pointer" width="40" height="40" style="border-radius: 4px; overflow: hidden;margin: auto;"/>
		<div class="mt-1">
			<b class="text-white opacity-90">Broswer</b>
		</div>
	</div>
	<div class="col-12" v-else>
		<div class="text-center">
			<InputGroup class="search-bar" style="border-radius: 8px;" >
			<MeshSelector 
				v-if="broswer.show"
				:form="false" 
				:full="true" 
				@select="getPorts"
				innerClass="flex "/>
				<Select v-if="broswer.mesh" size="small" class="w-full flex small"  v-model="broswer.port" :options="broswer.ports" optionLabel="name" :filter="broswer.ports.length>8" placeholder="Proxy"/>
			</InputGroup>					
		</div>
		<div class="mt-3 text-center">
			<InputGroup class="search-bar" style="border-radius: 8px;" >
				
				<Textarea v-model="broswer.url" :autoResize="true" class="drak-input bg-gray-900 text-white flex-1" placeholder="http://" rows="1" cols="30" />
				<!-- <Button :disabled="!broswer.url" icon="pi pi-search"/> -->
			</InputGroup>
		</div>
		<div class="mt-3 text-center flex">
			<div class="flex-item pr-2">
				<Button severity="secondary" class="w-full" style="height: 30px;" @click="closeBroswer" label="Back"/>
			</div>
			<div class="flex-item pl-2" style="flex: 2;">
				<Button class="w-full" style="height: 30px;" :disabled="!broswer.url" label="Open" @click="open"/>
		</div>
		</div>
	</div>									
</template>

<style lang="scss" scoped>
	.container {
		position: fixed;
		top: 0;
		bottom: 0;
		left: 0;
		right: 0;
	}
	:deep(.p-scrollpanel-bar.p-scrollpanel-bar-y){
		opacity: 0.5;
	}
	.actions{
		left: 0px;
		padding: 10px;
		display: flex;
		right: 0px;
		:deep(.p-button){
			padding-left: 5px;
			padding-right: 5px;
		}
	}
	:deep(.p-radiobutton .p-radiobutton-box){
		background-color: #41403A;
	}
	:deep(.p-togglebutton){
		border: none;
		color: transparent;
	}
	:deep(.p-togglebutton .pi){
		color: #fff !important;
	}
	.terminal_toolbar {
	  display: flex;
	  height: 30px;
	  align-items: center;
	  padding: 0 8px;
	  box-sizing: border-box;
	  border-top-left-radius: 5px;
	  border-top-right-radius: 5px;
	  background: linear-gradient(#504b45 0%, #3c3b37 100%);
	}
	
	.butt {
	  display: flex;
	  align-items: center;
	}
	
	.btn {
	  display: flex;
	  justify-content: center;
	  align-items: center;
	  padding: 0;
	  margin-right: 5px;
	  font-size: 8px;
	  height: 12px;
	  width: 12px;
	  box-sizing: border-box;
	  border: none;
	  border-radius: 100%;
	  background: linear-gradient(#7d7871 0%, #595953 100%);
	  text-shadow: 0px 1px 0px rgba(255,255,255,0.2);
	  box-shadow: 0px 0px 1px 0px #41403A, 0px 1px 1px 0px #474642;
	}
	
	.btn-color {
	  background: #ee411a;
	}
	
	.btn:hover {
	  cursor: pointer;
	}
	
	.btn:focus {
	  outline: none;
	}
	
	.butt--exit {
	  background: linear-gradient(#f37458 0%, #de4c12 100%);
	}
	
	.user {
	  color: #d5d0ce;
	  margin-left: 6px;
	  font-size: 14px;
	  line-height: 15px;
	}
	.container_pannel{
		background: rgba(56, 4, 40, 0.9);
		min-height: 100%;
	}
	.terminal_body {
	  height: calc(100%);
	  padding-top: 2px;
	  margin-top: 0px;
	  font-size: 12px;
	  border-bottom-left-radius: 5px;
	  border-bottom-right-radius: 5px;
	}
	.terminal_content{
		color: rgba(255,255,255,0.8);
	}
	.terminal_promt {
	  display: flex;
	}
	
	.terminal_promt span {
	  margin-left: 4px;
	}
	
	.terminal_user {
	  color: #7eda28;
	}
	
	.terminal_location {
	  color: #4878c0;
	}
	:deep(.p-inputgroup.search-bar .p-multiselect-label){
		line-height: 30px;
	}
	.terminal_bling {
	  color: #dddddd;
	}
	
	.terminal_cursor {
	  display: block;
	  height: 14px;
	  width: 5px;
	  margin-left: 10px;
	  animation: curbl 1200ms linear infinite;
	}
	
	@keyframes curbl {
	  
	  0% {
	    background: #ffffff;
	  }
	
	  49% {
	    background: #ffffff;
	  }
	
	  60% {
	    background: transparent;
	  }
	
	  99% {
	    background: transparent;
	  }
	
	  100% {
	    background: #ffffff;
	  }
	} 
	:deep(.p-button){
		width: 2rem;
		height: 2rem;
	}
</style>
