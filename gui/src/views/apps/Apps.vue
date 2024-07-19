<script setup>
import { ref, computed, onMounted, useSlots } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import AppService from '@/service/AppService';
import { apps, appMapping } from '@/utils/app-store'
import { openWebview } from '@/utils/webview';
import shortcutIcon from "@/assets/img/apps/shortcut.png";
import defaultIcon from "@/assets/img/apps/default.png";
import { resize } from "@/utils/window";

const slots = useSlots();
const router = useRouter();
const store = useStore();
const appService = new AppService();
const props = defineProps(['layout','noInners','embed','embedEp'])
const emits = defineEmits(['close','reload']);
const hide = () => {
	emits('close','')
	resize(455,350,false);
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

const innerApps = ref(apps);
const meshApps = ref([]);
const uninstallApps = ref([]);
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
	appService.getEpApps(selectedMesh.value?.name,props.embedEp || selectedMesh.value?.agent?.id).then((res)=>{
		console.log("start getApps")
		meshApps.value = res?.filter((app) => app.name !='terminal') || [];
		console.log(res);
		appService.getApps(selectedMesh.value?.name).then((res2)=>{
			console.log("uninstallApps:")
			console.log(res2)
			const _uninstallApps = [];
			res2.forEach((_uninstallApp)=>{
				const installed = meshApps.value.find((_app)=>app.name == _uninstallApp.name && app.provider == _uninstallApp.provider )
				if(!installed){
					_uninstallApps.push({
						..._uninstallApp,
						uninstall: true
					})
				}
			})
			uninstallApps.value = _uninstallApps;
		}).catch((e)=>{
			console.log(e)
		});
	}).catch((e)=>{
		console.log(e)
	});
	
}
const appPageSize = props.layout=='absolute_container'?24:16;
const pages = computed(()=>{
	const _apps = (!props.noInners?innerApps.value:[]).concat(meshApps.value||[]).concat(shortcutApps.value).concat(uninstallApps.value);
	const _pages = Math.ceil((_apps.length - 1)/appPageSize);
	return _pages>0?new Array(_pages):[];
});

const removeApp = (app) => {
	if(app.shortcut){
	
		appService.removeShortcut(app, () => {
			loaddata();
		})
	}else{
		appService.removeApp({
			mesh:selectedMesh.value?.name,
			ep:props.embedEp || selectedMesh.value?.agent?.id,
			provider:app.provider,
			app:app.name,
		}, () => {
			loaddata();
		})
	}
}
const appLoading = ref({})
const manage = ref(false);
const appPage = computed(()=>(page)=>{
	return (!props.noInners?innerApps.value:[]).concat((meshApps.value||[]).concat(shortcutApps.value).concat(uninstallApps.value)).filter((n,i) => i>=(page*appPageSize) && i< ((page+1)*appPageSize));
})
const openAppContent = (app) => {
		const options = {
			provider:app.provider||'ztm',
			app:app.name,
		}
		if(!!app.mesh){
			options.mesh = app.mesh?.name;
			options.ep = props.embedEp || app.mesh?.agent?.id;
		} else {
			options.mesh = selectedMesh.value?.name;
			options.ep = props.embedEp || selectedMesh.value?.agent?.id;
		}
		const base = appService.getAppUrl(options);
		if(app.uninstall){
			installAPP(app, options)
		}else if((app.name == 'proxy' || app.name == 'browser') && !app.shortcut){
			openAppUI(app, base);
		}else if(!app.isRunning && !!app.provider){
			appService.startApp(options).then(()=>{
				setTimeout(()=>{
					openAppUI(app, base);
				},300)
				loaddata();
			})
		} else {
			openAppUI(app, base);
		}
}
const selectApp = ref();
const openAppUI = (app, base) => {
	selectApp.value = null;
	const mappingApp = mapping.value[`${app?.provider||''}/${app.name}`];
	if(app.shortcut){
		appService.openbrowser(app)
	}else if(!mappingApp?.component && !app?.component){
		const webviewOptions = {
			url: mappingApp?.url || app?.url || `${base}/`,
			name: `${mappingApp?.name || app.name}App`,
			width:mappingApp?.width || app?.width || 1280,
			height:mappingApp?.height || app?.height || 860,
			proxy:''
		}
		console.log(webviewOptions)
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
		ep:props.embedEp || selectedMesh.value?.agent?.id,
		provider:app.provider||'ztm',
		app:app.name,
	}).then(()=>{
		loaddata();
	})
}
const publishApp = (app, isPublished) => {
	appService.pubApp({
		mesh:selectedMesh.value?.name,
		ep:props.embedEp || selectedMesh.value?.agent?.id,
		provider:app.provider,
		isPublished,
		app:app.name,
	},()=>{
		loaddata();
	});
}
const stopApp = (app) => {
	appService.stopApp({
		mesh:selectedMesh.value?.name,
		ep:props.embedEp || selectedMesh.value?.agent?.id,
		provider:app.provider||'ztm',
		app:app.name,
	}).then(()=>{
		loaddata();
	})
}
const installAPP = (app, options) => {
	try{
		appLoading.value[app.name] = true;
		appService.downloadApp(options, ()=>{
			setTimeout(() => {
				app.uninstall = false;
				appLoading.value[app.name] = false;
				loaddata();
			},500)
		})
		console.log(config.value)
	}catch(e){
	}
}
const current = ref(false);
const logApp = (app) => {
	///app/log/:mesh/:provider/:app
	const mappingApp = mapping.value[`${app?.provider||''}/${app.name}`];
	const webviewOptions = {
		url: `/#/app/log/${selectedMesh.value?.name}/${props.embedEp || selectedMesh.value?.agent?.id}/${app.provider||'ztm'}/${app.name}`,
		name: `${mappingApp?.name || app.name}Log`,
		width:mappingApp?.width || 1280,
		height:mappingApp?.height || 860,
		proxy:''
	}
	openWebview(webviewOptions);
}
const mapping = ref(appMapping);

const windowHeight = ref(window.innerHeight);
const pannelHeight = computed(() => windowHeight.value - 80);
onMounted(()=>{
	loaddata();
	resize(455,570,false);
})
</script>

<template>
	<ScrollPanel :class="props.layout">
	<div class="container_pannel" :style="`height: ${pannelHeight}px`">
			<AppHeader v-if="props.layout=='absolute_container'" :main="true">
					<template #center>
						<div v-if="!!selectedMesh" class="flex-item text-center" style="line-height: 30px;">
							<Status :run="selectedMesh.connected" :errors="selectedMesh.errors" />
							{{selectedMesh?.name}}
						</div>
						<b v-else>Apps</b>
					</template>
					<template #end> 
						<ToggleButton  v-if="!current"  class="transparent" v-model="manage"  onIcon="pi pi-chevron-left" 
												offIcon="pi pi-sliders-h"  :onLabel="'Manage'" :offLabel="' '"/>
					</template>
			</AppHeader>
			<div v-else class="flex actions transparent-header">
				<div class="flex-item">
					<Button  v-if="!current && !props.embed" v-tooltip.left="'Close'"  severity="help" text rounded aria-label="Filter" @click="hide" >
						<i class="pi pi-chevron-left " />
					</Button>
				</div>
				<div v-if="!!selectedMesh && !props.embed" class="flex-item text-center text-white" style="line-height: 30px;">
					<Status :run="selectedMesh.connected" :errors="selectedMesh.errors" />
					{{selectedMesh?.name}}
				</div>
				<div v-else-if="!props.embed" class="flex-item text-center text-white-alpha-70" style="line-height: 30px;">
					<i class="iconfont icon-warn text-yellow-500 opacity-90 text-2xl relative" style="top: 3px;" /> No mesh selected
				</div>
				<div class="flex-item text-right">
					<ToggleButton  v-if="!current"  class="transparent" v-model="manage"  onIcon="pi pi-times" 
					            offIcon="pi pi-sliders-h"  :onLabel="'Manage'" :offLabel="'.'"/>
				</div>
			</div>
	    <div class="terminal_body" v-if="!!app?.component">
				<component :is="app.component" :app="selectApp.options" @close="()=>selectApp=null"/>
			</div>
	    <div class="terminal_body" v-else-if="!!mapping[`${selectApp?.provider||''}/${selectApp?.name}`]?.component">
				<component :is="mapping[`${selectApp?.provider||''}/${selectApp?.name}`]?.component" :app="selectApp.options" @close="()=>selectApp=null"/>
			</div>
	    <div class="terminal_body px-4" :class="props.layout=='absolute_container'?'pt-6':'pt-2'" v-else-if="!manage">
				<div v-if="props.layout=='absolute_container' && !selectedMesh" class="flex-item text-center text-white-alpha-60 text-3xl" style="line-height: 30px;margin-top: 20%;">
					<i class="iconfont icon-warn text-yellow-500 opacity-90 text-4xl relative" style="top: 3px;" /> No mesh selected
				</div>
				<Carousel v-else :showNavigators="false" :value="pages" :numVisible="1" :numScroll="1" >
						<template #item="slotProps">
							<div class="pt-1" style="min-height: 440px;" >
								<div class="grid text-center" >
										<div :class="{'opacity-80':appLoading[app.name],'opacity-60':!appLoading[app.name] && app.uninstall,'col-3':props.layout!='absolute_container','col-2':props.layout=='absolute_container'}" @click="openAppContent(app)" class="py-4 relative text-center" v-for="(app) in appPage(slotProps.index)" >
											<img :src="app.icon || mapping[`${app?.provider||''}/${app.name}`]?.icon || defaultIcon" class="pointer" width="40" height="40" style="border-radius: 4px; overflow: hidden;margin: auto;"/>
											<ProgressSpinner v-if="appLoading[app.name]" class="absolute opacity-60" style="width: 30px; height: 30px;margin-left: -35px;margin-top: 5px;" strokeWidth="10" fill="#000"
											    animationDuration="2s" aria-label="Progress" />
											<div class="mt-1" v-tooltip="`${app.provider}/${app.name}`">
												<!-- <Badge value="3" severity="danger"></Badge> -->
												<b class="text-white opacity-90 white-space-nowrap">
													<i v-if="app.uninstall" class="pi pi-cloud-download mr-1" />
													{{ app.label || mapping[`${app?.provider||''}/${app.name}`]?.name || app.name}}
												</b>
											</div>
										</div>
								</div>
							</div>
						</template>
				</Carousel>
	    </div>
	    <div class="terminal_body px-4" :class="props.layout=='absolute_container'?'py-6':'py-2'" v-else>
				<div class="grid text-center" >
						<div class="col-12 py-1 relative align-items-center justify-content-center " v-for="(app) in meshApps.concat(uninstallApps)">
							<div class="flex">
								<img :src="app.icon || mapping[`${app?.provider||''}/${app.name}`]?.icon || defaultIcon" class="pointer" width="26" height="26" style="border-radius: 4px; overflow: hidden;margin: auto;"/>
								<div class="text-white opacity-90 flex-item text-left pl-3" style="line-height: 40px;"><b>{{ app.label ||mapping[`${app?.provider||''}/${app.name}`]?.name || app.name}}</b> | {{app.provider}}</div>
								
								<Button v-if="!!app.provider && !app.shortcut" v-tooltip.left="'App Log'" icon="pi pi-file" severity="help" text rounded aria-label="Filter" @click="logApp(app)" >
								</Button>
								<Button v-if="app.isRunning === false" v-tooltip.left="'Start'" icon="pi pi-caret-right" severity="help" text rounded aria-label="Filter" @click="startApp(app)" >
								</Button>
								<Button v-else-if="!!app.isRunning" v-tooltip.left="'Stop'" icon="pi pi-pause" severity="help" text rounded aria-label="Filter" @click="stopApp(app)" >
								</Button>
								<Button 
									v-if="!props.embed && !!app.provider && app.provider == selectedMesh?.agent?.username && !app.shortcut" 
									v-tooltip.left="!app.isPublished?'Publish':'Cancel publish'" 
									:icon="!app.isPublished?'pi pi-cloud-upload':'pi pi-cloud-download'" 
									severity="help" text rounded aria-label="Filter" 
									@click="publishApp(app, !app.isPublished)" >
								</Button>
								<Button v-if="app.provider != 'ztm' || app.shortcut" v-tooltip.left="'Delete'" icon="pi pi-trash" severity="help" text rounded aria-label="Filter" @click="removeApp(app)" >
								</Button>
							</div>
						</div>
						<div class="col-12 py-1 relative align-items-center justify-content-center " v-for="(app) in shortcutApps">
							<div class="flex">
								<img :src="app.icon || mapping[`${app?.provider||''}/${app.name}`]?.icon" class="pointer" width="26" height="26" style="border-radius: 4px; overflow: hidden;margin: auto;"/>
								<div class="text-white opacity-90 flex-item text-left pl-3" style="line-height: 40px;"><b>{{ app.label ||mapping[`${app?.provider||''}/${app.name}`]?.name || app.name}}</b> | {{app.provider}}</div>
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
	.transparent-header{
		:deep(.p-togglebutton){
			border: none;
			color: transparent;
		}
		:deep(.p-togglebutton .pi){
			color: #fff !important;
		}
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
