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
const selectedMesh = computed(() => {
	return store.getters["account/selectedMesh"]
});
const proxy = ref(true);
const browser = ref({
	name:'',
	url:'http://',
	listen:'',
});
const openbrowser = () => {
	appService.openbrowser({
		...props.app, 
		url: browser.value.url, 
		proxy:proxy.value
	})
}
const closebrowser = () => {
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
		provider:'ztm',
		name:'proxy',
		mesh:selectedMesh.value,
		label:browser.value.name,
		url:browser.value.url,
		proxy: proxy.value
	});
	store.commit('account/setShortcuts', shortcuts);
	op.value.hide();
	toast.add({ severity: 'contrast', summary:'Tips', detail: `${browser.value.name} shortcut added`, life: 3000 });
	browser.value.name = "";
}

const getEndpoints = () => {
	console.log("browser endpoints start");
	appService.invokeAppApi({
		base: props.app?.base,
		url:'/api/endpoints',
		method: 'GET',
		body: {}
	})
		.then(res => {
			console.log("browser endpoints");
			console.log(res);
			browser.value.endpoints = res || [];
		})
		.catch(err => {
		}); 
}
const listens = ref([]);

const appOption = computed(() => ({
	mesh:selectedMesh.value?.name,
	ep:selectedMesh.value?.agent?.id,
	provider:'ztm',
	app:'proxy',
}));
const isRunning = ref(false);
const getApp = ()=>{
	appService.getApp(appOption.value).then((res)=>{
		if(!!res.isRunning){
			setTimeout(()=>{
				isRunning.value = true;
			},300)
		}
	})
}
const getListen = () => {
	appService.getProxyListen(selectedMesh.value).then((res)=>{
		listens.value = res?[res.listen]:[];
		browser.value.listen = res.listen;
	});
}
const saving = ref(false);
const start = (app) => {
	saving.value = true;
	appService.startApp(appOption.value).then(()=>{
		isRunning.value = true;
		saving.value = false;
		getListen();
	})
}
onMounted(()=>{
	getApp();
	getListen();
})
const op = ref();
const toggle = (event) => {
	browser.value.name = "";
	op.value.toggle(event);
}
</script>

<template>
	<div class="col-12 min-h-screen pl-0 pr-0" style="background: rgba(56, 4, 40, 0.9);">
		
		<AppHeader>
				<template #start>
					<Button @click="closebrowser" icon="pi pi-angle-left" severity="secondary" text />
				</template>
				<template #center>
					<b>Browser</b>
				</template>
				<template #end> 
					<Button icon="pi" severity="secondary" text />
				</template>
		</AppHeader>
		
		<div class="px-3">
			<div class="text-center">
				<InputGroup class="search-bar" style="border-radius: 8px;" >
					<Button size="small" label="Proxy:" style="width: auto;"/>
					<Select size="small" class="w-full flex small"  v-model="browser.listen" :options="listens" :placeholder="isRunning?'Unset.':'Paused.'">
						<template #dropdownicon>
							<div v-if="!isRunning" class="flex-item pl-2" >
								<Button size="small" :loading="saving" icon="pi pi-play" @click="start"/>
							</div>
							<ToggleSwitch v-else class="relative green" v-model="proxy" style="left: -5px;" />
						</template>
					</Select>
				</InputGroup>					
			</div>
			<div class="mt-3 text-center">
				<InputGroup class="search-bar" style="border-radius: 8px;" >
					<Textarea v-model="browser.url" :autoResize="true" class="drak-input bg-gray-900 text-white flex-1" placeholder="http://" rows="1" cols="30" />
					<!-- <Button :disabled="!browser.url" icon="pi pi-search"/> -->
				</InputGroup>
			</div>
			<div class="mt-3 text-center flex">
				<div class="flex-item pr-2">
					<Button severity="secondary" aria-haspopup="true" aria-controls="op" @click="toggle" :disabled="browser.url.length<8" class="w-full" style="height: 30px;" label="Shortcut"/>
				</div>
				<div class="flex-item pl-2" >
					<Button class="w-full" style="height: 30px;" :disabled="browser.url.length<8" label="Open" @click="openbrowser()"/>
			</div>
			</div>
			<Popover class="ml-6 mt-3" ref="op" appendTo="self">
					<InputText size="small" placeholder="As Name" v-model="browser.name"  class="w-20rem"></InputText>
					<Button size="small" icon="pi pi-save" class="ml-2"  @click="addShortcut"></Button>
			</Popover>
		</div>		
	</div>									
</template>

<style lang="scss" scoped>
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
	:deep(.p-inputgroup.search-bar .p-multiselect-label){
		line-height: 30px;
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
