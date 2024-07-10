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
import shortcutIcon from "@/assets/img/apps/shortcut.png";
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
const shortcutApps = computed(() => {
	// let shortcuts = []
	// try{
	// 	shortcuts = JSON.parse(localStorage.getItem("SHORTCUT")||"[]");
	// }catch(e){
	// 	shortcuts = []
	// }
	let shortcuts = store.getters["account/shortcuts"];
	shortcuts.forEach((shortcut)=>{
		shortcut.icon = shortcut.icon || shortcutIcon;
		shortcut.shortcut = true;
	})
	console.log("shortcutApps")
	console.log(JSON.parse(localStorage.getItem("SHORTCUT")||"[]"))
	return shortcuts;
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
		allApps.value = res.filter((app) => app.name !='terminal');
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
const sysApp = 5;
const pages = computed(()=>{
	const _apps = ((allApps.value||[]).concat(shortcutApps.value));
	const _pages = Math.ceil((_apps.length + sysApp + innerApps.value.length - 1)/8);
	return _pages>0?new Array(_pages):[];
});
const removeApp = (app) => {
	if(app.shortcut){
		let shortcuts = []
		try{
			shortcuts = JSON.parse(localStorage.getItem("SHORTCUT")||"[]");
		}catch(e){
			shortcuts = []
		}
		store.commit('account/setShortcuts', shortcuts.filter((shortcut) => shortcut.label !=app.label));
	}else{
		appService.removeApp(app, () => {
			emits('reload','')
		})
	}
}
const appLoading = ref({})
const appPageSize = 8;
const manage = ref(false);
const appPage = computed(()=>(page)=>{
	return ((allApps.value||[]).concat(shortcutApps.value)).filter((n,i) => i>=(page*appPageSize - sysApp) && i< ((page+1)*appPageSize - sysApp));
})
const openAppContent = (app) => {
		const options = {
			provider:app.provider||'ztm',
			app:app.name,
		}
		if(!!app.mesh){
			options.mesh = app.mesh?.name;
			options.ep = app.mesh?.agent?.id;
		} else {
			options.mesh = selectedMesh.value?.name;
			options.ep = selectedMesh.value?.agent?.id;
		}
		const base = appService.getAppUrl(options);
		console.log(base)
		if(!app.isRunning){
			appService.startApp(options).then(()=>{
				openAppUI(app, base);
				loaddata();
			})
		} else {
			openAppUI(app, base);
		}
}
const selectApp = ref();
const openAppUI = (app, base) => {
	selectApp.value = null;
	const mappingApp = mapping.value[`${app?.provider}/${app.name}`];
	if(app.shortcut){
		appService.openBroswer(app)
	}else if(!mappingApp?.custom){
		const webviewOptions = {
			url: base,
			name: mappingApp?.name || app.name,
			width:mappingApp?.width || 1280,
			height:mappingApp?.height || 860,
			proxy:''
		}
		openWebview(webviewOptions);
	} else {
		selectApp.value = {
			...app,
			options:{
				base,
				name:app.name,
				label:mappingApp?.name || app.name,
				provider: app.provider,
				mesh:selectedMesh.value
			}
		};
	}
}
const startApp = (app) => {
	appService.startApp({
		mesh:selectedMesh.value?.name,
		ep:selectedMesh.value?.agent?.id,
		provider:app.provider||'ztm',
		app:app.name,
	}).then(()=>{
		loaddata();
	})
}
const stopApp = (app) => {
	appService.stopApp({
		mesh:selectedMesh.value?.name,
		ep:selectedMesh.value?.agent?.id,
		provider:app.provider||'ztm',
		app:app.name,
	}).then(()=>{
		loaddata();
	})
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
const mapping = ref(appMapping);
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
				<div v-if="!!selectedMesh" class="flex-item text-center text-white" style="line-height: 30px;">
					<Status :run="selectedMesh.connected" :errors="selectedMesh.errors" />
					{{selectedMesh?.name}}
				</div>
				<div v-else class="flex-item text-center text-white-alpha-70" style="line-height: 30px;">
					<i class="iconfont icon-warn text-yellow-500 opacity-90 text-2xl relative" style="top: 3px;" /> No mesh selected
				</div>
				<div class="flex-item text-right">
					<Button  v-if="!current" v-tooltip.left="'Close'"  severity="help" text rounded aria-label="Filter" @click="hide" >
						<i class="pi pi-times " />
					</Button>
				</div>
			</div>
	    <div class="terminal_body py-2 px-4" v-if="!!mapping[`${selectApp?.provider}/${selectApp?.name}`]?.custom">
				<component :is="mapping[`${selectApp?.provider}/${selectApp?.name}`]?.custom" :app="selectApp.options" @close="()=>selectApp=null"/>
			</div>
	    <div class="terminal_body py-2 px-4" v-else-if="!manage">
				<Carousel :showNavigators="false" :value="pages" :numVisible="1" :numScroll="1" >
						<template #item="slotProps">
							<div class="pt-1" style="min-height: 220px;">
								<div class="grid text-center" >
										<Console v-if="slotProps.index==0"/>
										<Store v-if="slotProps.index==0"/>
										<!-- <Broswer @open="() => current='Broswer'" @close="() => current=false"/> -->
										<Term v-if="slotProps.index==0"/>
										<ZtmLog v-if="slotProps.index==0"/>
										<EpLog  v-if="slotProps.index==0"/>
										<div :class="{'opacity-80':appLoading[app.name]}" @click="openAppContent(app)" class="col-3 py-4 relative text-center" v-for="(app) in appPage(slotProps.index)" >
											
											<img :src="app.icon || mapping[`${app?.provider}/${app.name}`]?.icon" class="pointer" width="40" height="40" style="border-radius: 4px; overflow: hidden;margin: auto;"/>
											<ProgressSpinner v-if="appLoading[app.name]" class="absolute opacity-60" style="width: 30px; height: 30px;margin-left: -35px;margin-top: 5px;" strokeWidth="10" fill="#000"
											    animationDuration="2s" aria-label="Custom ProgressSpinner" />
											<div class="mt-1" v-tooltip="`${app.provider}/${app.name}`">
												<!-- <Badge value="3" severity="danger"></Badge> -->
												<b class="text-white opacity-90">{{ app.label || mapping[`${app?.provider}/${app.name}`]?.name || app.name}}</b>
											</div>
										</div>
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
						<div class="col-12 py-1 relative align-items-center justify-content-center " v-for="(app) in allApps.concat(innerApps)">
							<div class="flex">
								<img :src="app.icon || mapping[`${app?.provider}/${app.name}`]?.icon" class="pointer" width="20" height="20" style="border-radius: 4px; overflow: hidden;margin: auto;"/>
								<div class="text-white opacity-90 flex-item text-left pl-3" style="line-height: 35px;"><b>{{ app.label ||mapping[`${app?.provider}/${app.name}`]?.name || app.name}}</b> | {{app.provider}}</div>
								<Button v-if="app.isRunning === false" v-tooltip.left="'Start'" icon="pi pi-caret-right" severity="help" text rounded aria-label="Filter" @click="startApp(app)" >
								</Button>
								<Button v-else-if="!!app.isRunning" v-tooltip.left="'Stop'" icon="pi pi-pause" severity="help" text rounded aria-label="Filter" @click="stopApp(app)" >
								</Button>
								<Button v-if="app.provider != 'ztm' || app.shortcut" v-tooltip.left="'Delete'" icon="pi pi-trash" severity="help" text rounded aria-label="Filter" @click="removeApp(app)" >
								</Button>
							</div>
						</div>
						<div class="col-12 py-1 relative align-items-center justify-content-center " v-for="(app) in shortcutApps">
							<div class="flex">
								<img :src="app.icon || mapping[`${app?.provider}/${app.name}`]?.icon" class="pointer" width="20" height="20" style="border-radius: 4px; overflow: hidden;margin: auto;"/>
								<div class="text-white opacity-90 flex-item text-left pl-3" style="line-height: 35px;"><b>{{ app.label ||mapping[`${app?.provider}/${app.name}`]?.name || app.name}}</b> | {{app.provider}}</div>
								<Button  v-tooltip.left="'Delete'" icon="pi pi-trash" severity="help" text rounded aria-label="Filter" @click="removeApp(app)" >
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
