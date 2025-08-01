<script setup>
import { ref, computed, onMounted, useSlots, watch } from 'vue';
import { useStore } from 'vuex';
import { useRouter, useRoute, onBeforeRouteUpdate } from 'vue-router';
import AppService from '@/service/AppService';
import { apps, appMapping } from '@/utils/app-store'
import { openWebview } from '@/utils/webview';
import shortcutIcon from "@/assets/img/apps/shortcut.png";
import defaultIcon from "@/assets/img/apps/default.png";
import { resize } from "@/utils/window";
import AppManage from './AppManage.vue';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
const slots = useSlots();
const router = useRouter();
const route = useRoute();
const store = useStore();
const appService = new AppService();
const props = defineProps(['layout','noInners','theme'])
const emits = defineEmits(['close','reload']);
const hide = () => {
	emits('close','')
	resize(455,350,false);
}
const selectedMesh = computed(() => {
	return store.getters["account/selectedMesh"]
});

const unread = computed(() => {
	return store.getters["notice/unread"];
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
		appService.getEpApps(selectedMesh.value?.name,selectedMesh.value?.agent?.id).then((res)=>{
		console.log("start getApps")
		meshApps.value = res?.filter((app) => app.name !='terminal') || [];
		//appService.getApps(selectedMesh.value?.name).then((res)=>{
		// console.log(res);
		// 	console.log("uninstallApps:")
		// 	console.log(res2)
		// 	const _uninstallApps = [];
		// 	(res2||[]).forEach((_uninstallApp)=>{
		// 		const installed = meshApps.value.find((_app)=>app.name == _uninstallApp.name && app.provider == _uninstallApp.provider )
		// 		if(!installed){
		// 			_uninstallApps.push({
		// 				..._uninstallApp,
		// 				uninstall: true
		// 			})
		// 		}
		// 	})
		// 	uninstallApps.value = _uninstallApps;
		// }).catch((e)=>{
		// 	console.log(e)
		// });
	}).catch((e)=>{
		console.log(e)
	});
	
}
const appLoading = ref({})
const manage = ref(false);
const mergeApps = computed(()=>{
	const _apps = (!props.noInners?innerApps.value:innerApps.value).concat(meshApps.value||[]).concat(uninstallApps.value);
	if(hasTauri.value){
		return _apps;
	} else {
		return _apps.filter((app) => `${app?.provider||''}/${app.name}` != 'ztm/users')
	}
})

const installAPP = (app, options, base) => {
	try{
		appLoading.value[app.name] = true;
		appService.downloadApp(options).then(()=>{
			app.uninstall = false;
			appLoading.value[app.name] = false;
			loaddata();
			openAppUI(app, base);
		})
		console.log(config.value)
	}catch(e){
		appLoading.value[app.name] = false;
		loaddata();
	}
}
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
		if(app.uninstall){
			installAPP(app, options, base)
		// }else if((app.name == 'proxy' || app.name == 'browser') && !app.shortcut){
		// }else if(!app.isRunning && !!app.provider){
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
	// }else if(app.url.indexOf("/#/") == 0){
	// 	router.push(app.url.replace('/#/','/'));
	}else if(!mappingApp?.component && !app?.component){
		const webviewOptions = {
			url: mappingApp?.url || app?.url || `${base}/`,
			name: `${mappingApp?.name || app.name}`,
			width:mappingApp?.width || app?.width || 1280,
			height:mappingApp?.height || app?.height || 860,
			proxy:''
		}
		console.log(webviewOptions)
		openWebview(webviewOptions);
	} else {
		const width = mappingApp?.width || app?.width || 455;
		const height = mappingApp?.height || app?.height || 570;
		resize(width,height,false);
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
const current = ref(false);
const mapping = ref(appMapping);

const windowHeight = ref(window.innerHeight);
const pannelHeight = computed(() => windowHeight.value - 80);
const close = () => {
	resize(455,570,false);
	selectApp.value = null;
}
const hasTauri = ref(!!window.__TAURI_INTERNALS__);
const routeApp = (app) => {
	if(!hasTauri.value){
		if((app?.url||'').indexOf('/#/') == 0){
			router.push(app.url.replace('/#/','/'));
		}else {
			router.push(`/mesh/app/${app.provider||'ztm'}/${app.name}`);
		}
	} else {
		openAppContent(app)
	}
}
onMounted(()=>{
	resize(455,570,false);
	if(!hasTauri.value && !!route?.params?.name && !!selectedMesh.value?.name){
		openAppContent(route?.params)
	}
})
onBeforeRouteUpdate(()=>{
	if(!hasTauri.value){
		if(!!route?.params?.name && !!selectedMesh.value?.name){
			openAppContent(route?.params)
		}
	}
})
watch(()=>manage,()=>{
	loaddata();
})

const selectMesh = (selected) => {
	store.commit('account/setSelectedMesh', selected);
}
watch(()=>selectedMesh,()=>{
	loaddata();
},{
	immediate:true,
	deep:true
})
</script>

<template>
	<div class="relative" style="z-index:3" v-if="!!app?.component">
		<component :is="app.component" :app="selectApp.options" @close="close"/>
	</div>
	<div class="relative" style="z-index:3" v-else-if="!!mapping[`${selectApp?.provider||''}/${selectApp?.name}`]?.component">
		<component :is="mapping[`${selectApp?.provider||''}/${selectApp?.name}`]?.component" :app="selectApp.options" @close="close"/>
	</div>
	<div v-else>
		<AppHeader v-if="props.layout=='absolute_container'" :main="true">
				<template #center>
					
					<div v-if="!!selectedMesh" class="flex-item text-center" style="line-height: 30px;">
						<Status :run="selectedMesh.connected" :errors="selectedMesh.errors" />
						{{selectedMesh?.name}}
					</div>
					<b v-else>{{t('Apps')}}</b>
				</template>
				<template #end> 
					<ToggleButton  v-if="!current"  class="transparent" v-model="manage"  onIcon="pi pi-chevron-left" 
											offIcon="pi pi-sliders-h"  :onLabel="t('Manage')" :offLabel="' '"/>
				</template>
		</AppHeader>
		<AppHeader class="transparent-header" v-else :main="true">
				<template #start> 
					<Button style="color: #fff;background-color: transparent !important;" icon="pi pi-chevron-left" class="app-btn"  v-if="!current" v-tooltip.left="t('Back')"  variant="text" severity="help" text @click="hide" ></Button>
				</template>
				<template #center>
					<MeshSelector
						:full="true" 
						innerClass="transparent"
						@load="load" 
						@select="selectMesh"/>
					<!-- <div v-if="!!selectedMesh" class="flex-item text-center" style="line-height: 30px;" :class="{'text-white':!props.theme}">
						<Status :run="selectedMesh.connected" :errors="selectedMesh.errors" />
						{{selectedMesh?.name}}
					</div>
					<div v-else class="flex-item text-center" :class="{'text-white-alpha-70':!props.theme}" style="line-height: 30px;">
						<i class="iconfont icon-warn text-yellow-500 opacity-90 text-2xl relative" style="top: 3px;" /> No mesh selected
					</div> -->
				</template>
				<template #end> 
					<ToggleButton  v-if="!current"  class="transparent" v-model="manage"  onIcon="pi pi-chevron-left" 
											offIcon="pi pi-sliders-h"  :onLabel="t('Manage')" :offLabel="' '"/>
				</template>
		</AppHeader>
		<ScrollPanel class="container_pannel" :class="props.layout" >
				<div class="terminal_body px-4 pt-8"  v-if="!manage">
					<div v-if="props.layout=='absolute_container' && !selectedMesh && !!props.noInners" class="flex-item text-center text-3xl" :class="{'text-white-alpha-60':!props.theme}" style="line-height: 30px;margin-top: 20%;">
						<i class="iconfont icon-warn text-yellow-500 opacity-90 text-4xl relative" style="top: 3px;" /> {{t('No mesh selected')}}
					</div>
					<div class="grid text-center" >
							<div  
								v-for="(app) in mergeApps"
								:class="{'opacity-80':appLoading[app.name],'opacity-60':!appLoading[app.name] && app.uninstall}" 
								@click="routeApp(app)" 
								class="py-4 relative text-center col-3 md:col-2" >
								<img :src="app.icon || mapping[`${app?.provider||''}/${app.name}`]?.icon || defaultIcon" class="pointer" width="40" height="40" style="border-radius: 4px; overflow: hidden;margin: auto;"/>
								<Badge class="absolute opacity-90" v-if="`${app?.provider||''}/${app.name}` == 'ztm/chat' && unread>0" style="margin-left: -10px;margin-top: -10px;" :value="unread" severity="danger"/>
								<ProgressSpinner v-if="appLoading[app.name]" class="absolute opacity-60" style="width: 30px; height: 30px;margin-left: -35px;margin-top: 5px;" strokeWidth="10" fill="#000"
										animationDuration="2s" aria-label="Progress" />
								<div class="mt-1" v-tooltip="`${app.provider||'local'}/${app.name}`">
									<b class="white-space-nowrap" :class="{'text-white-alpha-80':!props.theme}">
										<i v-if="app.uninstall" class="pi pi-cloud-download mr-1" />
										{{ t(app.label || mapping[`${app?.provider||''}/${app.name}`]?.name || app.name)}}
									</b>
								</div>
							</div>
					</div>
					<div v-if="props.layout=='absolute_container' && !selectedMesh && !props.noInners" class="flex-item text-center text-xl" :class="{'text-white-alpha-60':!props.theme}" style="line-height: 30px">
						<i class="iconfont icon-warn text-yellow-500 opacity-90 text-2xl relative" style="top: 3px;" /> {{t('No mesh selected')}}
					</div>
				</div>
				<div class="terminal_body px-4 pt-8" v-else>
					<AppManage 
						:theme="props.theme"
						:meshApps="meshApps" 
						@reload="loaddata"/>
				</div>
		</ScrollPanel>
	</div>
</template>

<style lang="scss" scoped>
	:deep(.p-scrollpanel-bar.p-scrollpanel-bar-y){
		opacity: 0.5;
	}
	.actions{
		left: 0px;
		padding: 7px 10px;
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
	  padding-top: 0px;
	  margin-top: 0px;
	  font-size: 12px;
	  border-bottom-left-radius: 5px;
	  border-bottom-right-radius: 5px;
	}
	:deep(.p-inputgroup.search-bar .p-multiselect-label){
		line-height: 30px;
	}
	.app-btn{
		width: 2rem;
		height: 2rem;
	}
</style>
