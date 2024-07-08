<script setup>
import { ref, computed, onMounted } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import AppService from '@/service/AppService';
import { apps, appMapping } from '@/utils/app-store'
import { openWebview } from '@/utils/webview';
import Term from './shortcut/Term.vue';
import Console from './shortcut/Console.vue';
import Store from './shortcut/Store.vue';
import ZtmLog from './shortcut/ZtmLog.vue';
import EpLog from './shortcut/EpLog.vue';
const router = useRouter();
const store = useStore();
const appService = new AppService();
const emits = defineEmits(['close','reload']);
const hide = () => {
	emits('close','')
}
const clear = () => {
}

const selectedMesh = computed(() => {
	return store.getters["account/selectedMesh"]
});

const allApps = ref([]);
const upload = (d)=>{
	if(!!d){
		try{
			const appJSON = JSON.parse(d);
			appService.newApp(appJSON,()=>{
				loaddata(true, 1500);
			})
			console.log(config.value)
		}catch(e){
		}
	}
}
const loaddata = () => {
	console.log("load apps",[selectedMesh.value?.name,selectedMesh.value?.agent?.id])
	appService.getEpApps(selectedMesh.value?.name,selectedMesh.value?.agent?.id).then((res)=>{
		console.log("start getApps")
		allApps.value = res;
		console.log(res)
	}).catch((e)=>{
		console.log(e)
	});
}
const innerApps = computed(()=>{
	const rtn = [];
	apps.forEach((app)=>{
		if(!(allApps.value||[]).find((papp)=>papp.name == app.name)){
			rtn.push({...app,loading:false})
		}
	});
	return rtn;
})
const pages = computed(()=>{
	const _pages = Math.ceil(((allApps.value||[]).length + 1 + innerApps.value.length)/8);
	return _pages>0?new Array(_pages):[];
});
const removeApp = (app) => {
	appService.removeApp(app, () => {
		emits('reload','')
	})
}
const appLoading = ref({})
const appPageSize = 8;
const manage = ref(false);
const sysApp = 2;
const appPage = computed(()=>(page)=>{
	return (allApps.value||[]).filter((n,i) => i>=page*appPageSize && i< (page+sysApp)*appPageSize);
})
const selectApp = ref();
const openAppContent = (app) => {
	if(!mapping.value[`${app?.provider}/${app?.name}`]?.custom){
		selectApp.value = null;
		const options = {
			mesh:selectedMesh.value?.name,
			ep:selectedMesh.value?.agent?.id,
			provider:app.provider||'ztm',
			app:app.name,
			body: {}
		}
		const url = appService.getAppUrl(options);
		console.log(url)
		const webviewOptions = {
			url,
			name:mapping.value[`${app?.provider}/${app.name}`]?.name || app.name,
			width:app.width,
			height:app.height,
			proxy:''
		}
		if(!app.isRunning){
			appService.startApp(options).then(()=>{
				openWebview(webviewOptions);
			})
		} else {
			openWebview(webviewOptions);
		}
	} else {
		selectApp.value = app;
	}
}
const installAPP = (app) => {
	try{
		appLoading.value[app.name] = true;
			appService.newApp(app,()=>{
				loaddata();
				setTimeout(() => {
					appLoading.value[app.name] = false;
				},500)
			})
		console.log(config.value)
	}catch(e){
	}
}
const current = ref(false);
onMounted(()=>{
	loaddata();
})
const mapping = ref(appMapping)
</script>

<template>
	<ScrollPanel class="container">
	<div class="container_pannel">
	    <div class="container_terminal"></div>
			<div class="flex actions">
				<div class="flex-item">
				<ToggleButton  v-if="!current"  class="transparent" v-model="manage"  onIcon="pi pi-chevron-left" 
				            offIcon="pi pi-sliders-h"  :onLabel="'Manage'" :offLabel="'.'"/>
				</div>
				<div class="flex-item text-right">
					<Button  v-if="!current" v-tooltip.left="'Close'"  severity="help" text rounded aria-label="Filter" @click="hide" >
						<i class="pi pi-times " />
					</Button>
				</div>
			</div>
	    <div class="terminal_body py-2 px-4" v-if="!!mapping[`${selectApp?.provider}/${selectApp?.name}`]?.custom">
				<component :is="mapping[`${selectApp?.provider}/${selectApp?.name}`]?.custom" @close="()=>selectApp=null"/>
			</div>
	    <div class="terminal_body py-2 px-4" v-else-if="!manage">
				<Carousel :showNavigators="false" :value="pages" :numVisible="1" :numScroll="1" >
						<template #item="slotProps">
							<div class="pt-1" style="min-height: 220px;">
								<div class="grid text-center" >
										<Console />
										<!-- <Broswer @open="() => current='Broswer'" @close="() => current=false"/> -->
										<Term/>
										<ZtmLog />
										<EpLog />
										<div :class="{'opacity-80':appLoading[app.name]}" @click="openAppContent(app)" class="col-3 py-4 relative text-center" v-for="(app) in appPage(slotProps.index)">
											
											<img :src="app.icon || mapping[`${app?.provider}/${app.name}`]?.icon" class="pointer" width="40" height="40" style="border-radius: 4px; overflow: hidden;margin: auto;"/>
											<ProgressSpinner v-if="appLoading[app.name]" class="absolute opacity-60" style="width: 30px; height: 30px;margin-left: -35px;margin-top: 5px;" strokeWidth="10" fill="#000"
											    animationDuration="2s" aria-label="Custom ProgressSpinner" />
											<div class="mt-1">
												<!-- <Badge value="3" severity="danger"></Badge> -->
												<b class="text-white opacity-90">{{ mapping[`${app?.provider}/${app.name}`]?.name || app.name}}</b>
											</div>
										</div>
										<Store />
										<!-- 
										<div v-if="!current" :class="{'opacity-80':appLoading[app.name],'opacity-60':!appLoading[app.name]}" @click="installAPP(app)" class="col-3 py-4 relative text-center " v-for="(app) in innerApps">
											<img :src="app.icon" class="pointer" width="40" height="40" style="border-radius: 4px; overflow: hidden;margin: auto;"/>
											<ProgressSpinner v-if="appLoading[app.name]" class="absolute opacity-60" style="width: 30px; height: 30px;margin-left: -35px;margin-top: 5px;" strokeWidth="10" fill="#000"
											    animationDuration="2s" aria-label="Custom ProgressSpinner" />
											<div class="mt-1">
												<b class="text-white opacity-90 white-space-nowrap"><i class="pi pi-cloud-download mr-1" />{{app.name}}</b>
											</div>
										</div> -->
								</div>
							</div>
						</template>
				</Carousel>
	    </div>
	    <div class="terminal_body py-2 px-4" v-else>
				<div class="grid text-center" >
						<div class="col-12 py-4 relative align-items-center justify-content-center " v-for="(app) in allApps.concat(innerApps)">
							<div class="flex">
								<img :src="app.icon" class="pointer" width="20" height="20" style="border-radius: 4px; overflow: hidden;margin: auto;"/>
								<div class="text-white opacity-90 flex-item text-left pl-3" style="line-height: 35px;"><b>{{app.name}}</b> | Provider</div>
								<ProgressSpinner v-if="appLoading[app.name]" class="absolute opacity-60" style="width: 30px; height: 30px;margin-left: -35px;margin-top: 5px;" strokeWidth="10" fill="#000"
										animationDuration="2s" aria-label="Custom ProgressSpinner" />
								<Button  v-tooltip.left="'Clear'" icon="pi pi-trash" severity="help" text rounded aria-label="Filter" @click="removeApp(app)" >
								</Button>
								<Button  v-tooltip.left="'Clear'" icon="pi pi-caret-right" severity="help" text rounded aria-label="Filter" @click="removeApp(app)" >
								</Button>
								<Button  v-tooltip.left="'Clear'" icon="pi pi-pause" severity="help" text rounded aria-label="Filter" @click="removeApp(app)" >
								</Button>
							</div>
						</div>

				</div>
	    </div>
	</div>
	</ScrollPanel>
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
	.container_pannel{
		background: rgba(56, 4, 40, 0.9);
		min-height: 100%;
	}
	.terminal_body, :deep(.terminal_body){
	  height: calc(100%);
	  padding-top: 2px;
	  margin-top: 0px;
	  font-size: 12px;
	  border-bottom-left-radius: 5px;
	  border-bottom-right-radius: 5px;
	}
	:deep(.p-inputgroup.search-bar .p-multiselect-label){
		line-height: 30px;
	}
	:deep(.p-button){
		width: 2rem;
		height: 2rem;
	}
</style>
