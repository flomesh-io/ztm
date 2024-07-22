<script setup>
import { ref, computed, onMounted } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import AppService from '@/service/AppService';
import { appMapping } from '@/utils/app-store'
import { openWebview } from '@/utils/webview';
import shortcutIcon from "@/assets/img/apps/shortcut.png";
import defaultIcon from "@/assets/img/apps/default.png";

const router = useRouter();
const store = useStore();
const appService = new AppService();
const props = defineProps(['embedEp','meshApps','theme'])
const emits = defineEmits(['reload']);
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

const uninstallApps = ref([]);

const removeApp = (app) => {
	if(app.shortcut){
		appService.removeShortcut(app, () => {
			emits('reload');
		})
	}else{
		appService.removeApp({
			mesh:selectedMesh.value?.name,
			ep:props.embedEp?.id || selectedMesh.value?.agent?.id,
			provider:app.provider,
			app:app.name,
		}, () => {
			emits('reload');
		})
	}
}
const startApp = (app) => {
	appService.startApp({
		mesh:selectedMesh.value?.name,
		ep:props.embedEp?.id || selectedMesh.value?.agent?.id,
		provider:app.provider||'ztm',
		app:app.name,
	}).then(()=>{
		emits('reload');
	})
}
const publishApp = (app, isPublished) => {
	appService.pubApp({
		mesh:selectedMesh.value?.name,
		ep:props.embedEp?.id || selectedMesh.value?.agent?.id,
		provider:app.provider,
		isPublished,
		app:app.name,
	},()=>{
		emits('reload');
	});
}
const stopApp = (app) => {
	appService.stopApp({
		mesh:selectedMesh.value?.name,
		ep:props.embedEp?.id || selectedMesh.value?.agent?.id,
		provider:app.provider||'ztm',
		app:app.name,
	}).then(()=>{
		emits('reload');
	})
}
const logApp = (app) => {
	///app/log/:mesh/:provider/:app
	const mappingApp = mapping.value[`${app?.provider||''}/${app.name}`];
	const webviewOptions = {
		url: `/#/app/log/${selectedMesh.value?.name}/${props.embedEp?.id || selectedMesh.value?.agent?.id}/${app.provider||'ztm'}/${app.name}`,
		name: `${mappingApp?.name || app.name}Log`,
		width:mappingApp?.width || 1280,
		height:mappingApp?.height || 860,
		proxy:''
	}
	openWebview(webviewOptions);
}
const mapping = ref(appMapping);

onMounted(()=>{
	emits('reload');
})
</script>

<template>
	<div class="grid text-center" >
			<div class="col-12 py-1 relative align-items-center justify-content-center " v-for="(app) in (props.meshApps||[])">
				<div class="flex">
					<img :src="app.icon || mapping[`${app?.provider||''}/${app.name}`]?.icon || defaultIcon" class="pointer" width="26" height="26" style="border-radius: 4px; overflow: hidden;margin: auto;"/>
					<div class="flex-item text-left pl-3" :class="{'text-white-alpha-80':!props.theme}" style="line-height: 40px;">
						<b>{{ app.label ||mapping[`${app?.provider||''}/${app.name}`]?.name || app.name}}</b> | 
						<i class="iconfont icon-provider" v-if="app?.provider == (props.embedEp?.username || selectedMesh.value?.agent?.username)"/>
						{{app.provider}}
					</div>
					
					<Button v-if="!!app.provider && !app.shortcut" v-tooltip.left="'App Log'" icon="pi pi-file" severity="help" text rounded aria-label="Filter" @click="logApp(app)" >
					</Button>
					<Button v-if="app.isRunning === false" v-tooltip.left="'Start'" icon="pi pi-caret-right" severity="help" text rounded aria-label="Filter" @click="startApp(app)" >
					</Button>
					<Button v-else-if="!!app.isRunning" v-tooltip.left="'Stop'" icon="pi pi-pause" severity="help" text rounded aria-label="Filter" @click="stopApp(app)" >
					</Button>
					<Button 
						v-if="!props.embedEp?.id && !!app.provider && app.provider == selectedMesh?.agent?.username && !app.shortcut" 
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
					<div class="flex-item text-left pl-3" :class="{'text-white-alpha-80':!props.theme}" style="line-height: 40px;"><b>{{ app.label ||mapping[`${app?.provider||''}/${app.name}`]?.name || app.name}}</b> | {{app.provider}} </div>
					<Button  v-tooltip.left="'Delete'" icon="pi pi-trash" severity="help" text rounded aria-label="Filter" @click="removeApp(app)" >
					</Button>
				</div>
			</div>
	</div>
</template>

<style lang="scss" scoped></style>
