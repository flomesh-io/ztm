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
const emits = defineEmits(['close']);
const selectedMesh = computed(() => {
	return store.getters["account/selectedMesh"]
});
const endpoints = ref([]);
const config = ref()
const saving = ref(false);
const saveProxy = () => {
	saving.value = true;
	appService.setProxy({
		mesh:selectedMesh.value,
		outbounds:outbounds.value, 
		listen:listen.value, 
	},(res) => {
		toast.add({ severity: 'success', summary: 'Tips', detail: "Proxy saved", life: 3000 });
		saving.value = false;
	})
}
const close = () => {
	emits('close');
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
			endpoints.value = res || [];
			saving.value = false;
		})
		.catch(err => {
		}); 
}

const op = ref();
const toggle = (event) => {
	browser.value.name = "";
	op.value.toggle(event);
}
const listen = ref('');
const newOutbound = ref({
	ep:null,
	targets:['*','0.0.0.0/0',""]
})
const outbounds = ref([]);
const filterOutbounds = computed(()=>{
	return (outbounds.value||[]).filter((outbound)=>!!outbound.ep && outbound.targets.length>0)
})
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
				loaddata();
			},300)
		}
	})
}
const loaddata = ()=>{
	getEndpoints();
	appService.getProxyListen(selectedMesh.value).then((res)=>{
		console.log('getProxyListen')
		console.log(res)
		listen.value = res.listen;
	});
	appService.getProxyOutbounds(selectedMesh.value).then((res)=>{
		outbounds.value = res||[];
	});
}

const start = (app) => {
	saving.value = true;
	appService.startApp(appOption.value).then(()=>{
		getApp();
	})
}
const stop = (app) => {
	appService.stopApp(appOption.value).then(()=>{
		isRunning.value = false;
	})
}
onMounted(()=>{
	getApp();
});
</script>

<template>
	<div class="col-12" style="padding-left: 0;padding-right: 0">
		<ul class="list-none px-2 m-0" v-if="isRunning">
			<li class="flex align-items-center py-3 px-2  surface-border flex-wrap">
				<div class="font-medium font-bold w-3 text-white">Listen</div>
				<InputGroup class="search-bar" style="border-radius: 8px;" >
					<InputText size="small" v-model="listen"  class="drak-input bg-gray-900 text-white flex-1"  placeholder="Listen (HOST:PORT)" />
					<Button size="small" icon="pi pi-sort" v-tooltip="'Listen=ip:port'" />
				</InputGroup>
			</li>
			<li class="flex align-items-center py-3 px-2  surface-border flex-wrap">
				<div class="font-medium font-bold w-3 text-white">Outbounds</div>
				<InputList
					class="w-full mt-2"
					itemClass="input_pannel"
					:d="outbounds"
					:min="1"
					:attrs="newOutbound"
				>
					<template #default="{ item, index }">
						<div class="grid grid-nogutter ">
								<div class="col-12">
									<InputGroup class="search-bar" style="border-radius: 8px;" >
										<Select :id="`outbound-ep-${index}`" size="small" class="w-full flex small"  v-model="item.ep" :options="endpoints" optionLabel="name" optionValue="id" :filter="endpoints.length>8" placeholder="Endpoint"/>
									</InputGroup>
								</div>
								<div class="col-12 mt-2">
									<ChipList direction="v" icon="pi pi-link" :id="`outbound-targets-${index}`" placeholder="Target" v-model:list="item.targets" />
								</div>
						</div>
					</template>
				</InputList>
			</li>
		</ul>
		
		<div v-else class="flex-item text-center text-white-alpha-70" style="line-height: 30px;">
			<i class="iconfont icon-warn text-yellow-500 opacity-90 text-2xl relative" style="top: 3px;" /> First, start proxy.
		</div>
		<div class="px-3 mt-4">
			<div class="text-center flex">
				<div class="flex-item pr-2">
					<Button severity="secondary" class="w-full" style="height: 30px;" @click="close" label="Back"/>
				</div>
				<div v-if="isRunning" class="flex-item pr-2">
					<Button severity="secondary" class="w-full" style="height: 30px;" @click="stop" label="Stop"/>
				</div>
				<div v-if="!isRunning" class="flex-item pl-2" >
					<Button :loading="saving" class="w-full" style="height: 30px;" label="Start" @click="start"/>
				</div>
				<div v-if="isRunning" class="flex-item pl-2" >
					<Button :loading="saving" class="w-full" style="height: 30px;" :disabled="!listen || filterOutbounds.length==0" label="Save" @click="saveProxy"/>
				</div>
			</div>
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
