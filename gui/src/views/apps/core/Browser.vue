<script setup>
import { ref, computed, onMounted } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import AppService from '@/service/AppService';
import toast from "@/utils/toast";
import confirm from "@/utils/confirm";
import { invoke } from '@tauri-apps/api/core';
import defaultIcon from "@/assets/img/apps/default.png";

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
const historys = ref([])
const loadHistory = () => {
	invoke('get_store_list',{ key: 'history' }).then((list)=>{
		historys.value = list;
	});
}
const closebrowser = () => {
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
		if(!!res?.isRunning){
			setTimeout(()=>{
				isRunning.value = true;
			},300)
		}
	})
}
const getListen = () => {
	appService.getProxyListen(selectedMesh.value).then((res)=>{
		if(res?.listen){
			listens.value = res?[res.listen]:[];
			browser.value.listen = res.listen;
		}
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
const shortcutApps = ref([]);
const loadshortcut = () => {
	invoke('get_store_list',{ key: 'shortcut' }).then((list)=>{
		shortcutApps.value = list;
	});
}

const removeStar = (idx) => {
	confirm.remove(() => {
		const _store_history = historys.value || [];
		if(idx>=0){
			_store_history.splice(idx,1);
		}
		invoke('set_store_list', {
			key: 'history',
			value: _store_history
		}).then((res)=>{
			historys.value = _store_history;
		});
	});
}
const removeShortcut= (idx) => {
	confirm.remove(() => {
		const _store_shortcut = shortcutApps.value || [];
		if(idx>=0){
			_store_shortcut.splice(idx,1);
		}
		invoke('set_store_list', {
			key: 'shortcut',
			value: _store_shortcut
		}).then((res)=>{
			shortcutApps.value = _store_shortcut;
		});
	});
}
const routeApp = (shortcut) => {
	const app = {
		...props.app,
		provider:'ztm',
		name:'proxy',
		mesh:selectedMesh.value,
		label:shortcut.title,
		url:shortcut.href,
		proxy: proxy.value
	}
	appService.openbrowser(app)
}

onMounted(()=>{
	getApp();
	getListen();
	loadHistory();
	loadshortcut();
})
</script>

<template>
	<div class="col-12 min-h-screen pl-0 pr-0" style="background: rgba(56, 4, 40, 0.9);">
		<div class="ztm-content"></div>
		<div class="ztm-container">
			<div class="ztm-left">
				<button @click="closebrowser" class="go-back">
					<svg t="1732001278031" class="ztm-icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1093" width="18" height="18"><path d="M932.039565 483.875452 163.745365 483.875452l350.590843-311.627437c11.008728-9.784854 12.000312-26.6428 2.215458-37.651528-9.7869-11.005658-26.63973-11.999288-37.652552-2.214435L74.241888 492.064972c-5.693676 5.062296-8.950859 12.31549-8.950859 19.934005s3.257184 14.871709 8.950859 19.934005l404.65825 359.684966c5.080715 4.51585 11.405771 6.735401 17.708314 6.735401 7.352455 0 14.675234-3.022847 19.944238-8.950859 9.784854-11.008728 8.79327-27.865651-2.215458-37.652552L160.472831 537.214265l771.566734 0c14.729469 0 26.669406-11.94096 26.669406-26.669406C958.708971 495.815389 946.769035 483.875452 932.039565 483.875452z" p-id="1094"></path></svg>
				</button>
			</div>
			<div style="padding: 5px 10px  5px 0;">
				<Select size="small"  v-model="browser.listen" :options="listens" :placeholder="isRunning?'No Proxy':'Paused.'">
					<template #dropdownicon>
						<div v-if="!isRunning" class="flex-item" >
							<Button style="left: 5px;" size="small" :loading="saving" icon="pi pi-play" @click="start"/>
						</div>
						<ToggleSwitch v-else class="relative green" v-model="proxy" style="left: -5px;" />
					</template>
				</Select>
			</div>
			<div class="ztm-right" style="padding: 5px 10px  5px 0;">
				<svg t="1732001390375" class="ztm-icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1578" width="14" height="14"><path d="M963.584 934.912L711.68 683.008C772.096 615.424 808.96 527.36 808.96 430.08 808.96 221.184 638.976 51.2 430.08 51.2S51.2 221.184 51.2 430.08s169.984 378.88 378.88 378.88c97.28 0 185.344-36.864 252.928-97.28l251.904 251.904c4.096 4.096 9.216 6.144 14.336 6.144s10.24-2.048 14.336-6.144c8.192-8.192 8.192-20.48 0-28.672zM430.08 768C243.712 768 92.16 616.448 92.16 430.08S243.712 92.16 430.08 92.16s337.92 151.552 337.92 337.92-151.552 337.92-337.92 337.92z" p-id="1579"></path></svg>
				<input type="text" placeholder="" v-model="browser.url" @keyup.enter="openbrowser()"/>
			</div>
		</div>
		<div class="ztm-history" style="display:none"></div>
		
		<div class="px-3">
			<!-- <div class="mt-3 text-center flex">
				<div class="flex-item pr-2">
					<Button severity="secondary" aria-haspopup="true" aria-controls="op" @click="toggle" :disabled="browser.url.length<8" class="w-full" style="height: 30px;" label="Shortcut"/>
				</div>
			</div> -->
			<div class="terminal_body pt-2" >
				<div class="grid text-center" >
						<div  
							v-for="(shortcut,idx) in shortcutApps"
							@click="routeApp(shortcut)" 
							class="py-4 relative text-center col-3 md:col-2" >
							<div class="ztm-icon-bg">
								<img v-longtap="()=>{removeShortcut(idx)}" :src="shortcut.icon || defaultIcon" class="pointer" width="40" height="40" style="border-radius: 4px; overflow: hidden;margin: auto;"/>
							</div>
							<div class="mt-1">
								<b v-tooltip="shortcut.title" class="text-white-alpha-80 multiline-ellipsis-2" >
									{{ shortcut.title }}
								</b>
							</div>
						</div>
				</div>
			</div>
			<div class="grid p-2">
				<div v-for="(history,idx) in historys" class="p-2 col-6 md:col-4" >
					<div class="p-3 rounded history-card" >
						<div class="mb-4 font-medium flex">
							<img v-if="history.icon" :src="history.icon" class="pointer" width="20" height="20" style="border-radius: 4px; overflow: hidden;margin-right: 5px;"/>
							<svg v-else t="1732524995707" class="ztm-icon ztm-link-icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1740" width="20" height="20"><path d="M510.293333 785.066667H256c-51.694933 0-96.529067-18.619733-133.239467-55.3472C86.596267 693.5552 68.266667 649.0112 68.266667 597.333333c0-51.6096 18.295467-96.4096 54.391466-133.137066 36.317867-35.6864 80.469333-53.981867 131.4304-54.596267 9.762133 0.4608 17.152 7.441067 17.271467 16.861867A17.066667 17.066667 0 0 1 254.498133 443.733333c-42.461867 0.512-77.687467 15.104-107.7248 44.5952C116.992 518.656 102.4 554.376533 102.4 597.333333c0 42.9056 14.557867 78.301867 44.4928 108.253867C177.408 736.1024 213.0944 750.933333 256 750.933333h254.293333c42.871467 0 78.2336-14.7968 108.1344-45.243733C649.096533 675.549867 663.893333 640.170667 663.893333 597.333333c0-42.9056-14.830933-78.574933-45.346133-109.1072C588.578133 458.2912 553.181867 443.733333 510.293333 443.733333h-82.773333a17.066667 17.066667 0 0 1 0-34.133333h82.773333c51.6608 0 96.2048 18.3296 132.386134 54.4768C679.424 500.821333 698.026667 545.655467 698.026667 597.333333c0 51.729067-18.653867 96.324267-55.4496 132.488534C606.651733 766.395733 562.0736 785.066667 510.293333 785.066667zM768 614.4a17.066667 17.066667 0 1 1 0-34.133333c42.871467 0 78.2336-14.7968 108.1344-45.243734C906.8032 504.8832 921.6 469.521067 921.6 426.666667c0-42.9056-14.830933-78.592-45.346133-109.1072C846.318933 287.624533 810.922667 273.066667 768 273.066667H513.706667c-42.9568 0-78.677333 14.592-109.2096 44.5952C374.698667 347.989333 360.106667 383.6928 360.106667 426.666667c0 42.9056 14.557867 78.318933 44.4928 108.253866C435.0976 565.435733 470.784 580.266667 513.706667 580.266667h82.7904a17.066667 17.066667 0 1 1 0 34.133333H513.706667c-51.712 0-96.529067-18.619733-133.256534-55.3472C344.302933 522.9056 325.973333 478.3616 325.973333 426.666667c0-51.626667 18.295467-96.426667 54.391467-133.137067C417.28 257.2288 462.08 238.933333 513.706667 238.933333H768c51.694933 0 96.238933 18.3296 132.386133 54.493867C937.1136 330.1376 955.733333 374.971733 955.733333 426.666667c0 51.7632-18.653867 96.341333-55.4496 132.488533C864.3584 595.729067 819.7632 614.4 768 614.4z" p-id="1741"></path></svg>
							<b @click="routeApp(history)" class="flex-item multiline-ellipsis-2 pr-2 pointer">{{ history.title }}</b>
							<Button @click="removeStar(idx)" style="color:orange" icon="pi pi-star-fill" size="small" severity="secondary"/>
						</div>
						<div class="flex justify-between items-center pointer">
							<div class="mt-0 text-sm flex-item multiline-ellipsis" style="word-break: break-all;">
								<a @click="routeApp(history)">{{ history.href }}</a>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>		
	</div>									
</template>

<style lang="scss" scoped>
	@import '@/assets/broswer.scss';
</style>
