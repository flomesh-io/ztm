<script setup>
import { ref, computed, onMounted } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import AppService from '@/service/AppService';
import toast from "@/utils/toast";

const router = useRouter();
const store = useStore();
const appService = new AppService();
const props = defineProps(['app']);
const emits = defineEmits(['close'])
const broswer = ref({
	mesh:null,
	name:'',
	url:'http://',
	endpoint:null,
	endpoints:[]
});
const openBroswer = (endpoint, url) => {
	appService.openBroswer({...props.app, endpoint, url})
}
const closeBroswer = () => {
	emits('close');
}
const addShortcut = () => {
	let shortcuts = []
	try{
		shortcuts = JSON.parse(localStorage.getItem("SHORTCUT")||"[]");
	}catch(e){
		shortcuts = []
	}
	shortcuts.push({
		...props.app,
		label:broswer.value.name,
		url:broswer.value.url,
		endpoint:broswer.value.endpoint,
	});
	store.commit('account/setShortcuts', shortcuts);
	op.value.hide();
	broswer.value.name = "";
	toast.add({ severity: 'contrast', summary:'Tips', detail: `${broswer.value.name} shortcut added`, life: 3000 });
}

const getEndpoints = () => {
	console.log("broswer endpoints start");
	appService.invokeAppApi({
		base: props.app?.base,
		url:'/api/endpoints',
		method: 'GET',
		body: {}
	})
		.then(res => {
			console.log("broswer endpoints");
			console.log(res);
			broswer.value.endpoints = res || [];
		})
		.catch(err => {
		}); 
}
onMounted(()=>{
	getEndpoints();
})

const op = ref();
const toggle = (event) => {
	broswer.value.name = "";
	op.value.toggle(event);
}
</script>

<template>
	<div class="col-12">
		<div class="text-center">
			<InputGroup class="search-bar" style="border-radius: 8px;" >
				<Select size="small" class="w-full flex small"  v-model="broswer.endpoint" :options="broswer.endpoints" optionLabel="name" optionValue="id" :filter="broswer.endpoints.length>8" placeholder="Endpoint"/>
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
			<div class="flex-item pr-2">
				<Button aria-haspopup="true" aria-controls="op" @click="toggle" :disabled="broswer.url.length<8" class="w-full" style="height: 30px;" label="Shortcut"/>
			</div>
			<div class="flex-item pl-2" >
				<Button class="w-full" style="height: 30px;" :disabled="broswer.url.length<8" label="Open" @click="openBroswer(broswer.endpoint,broswer.url)"/>
		</div>
		</div>
		<Popover class="ml-6 mt-3" ref="op" appendTo="self">
				<InputText placeholder="As Name" v-model="broswer.name"  class="w-20rem"></InputText>
				<Button size="small" icon="pi pi-save" class="ml-2"  @click="addShortcut"></Button>
		</Popover>
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
