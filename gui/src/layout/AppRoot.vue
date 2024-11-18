<script setup>
import { ref, computed,watch, onMounted, onBeforeUnmount } from 'vue';
import { useStore } from 'vuex';
import { removeAuthorization, AUTH_TYPE } from "@/service/common/request";
import { useLayout } from '@/layout/composables/layout';
import { useRouter } from 'vue-router';
import PipyVersion from '@/components/mesh/PipyVersion.vue';
import XeyeSvg from "@/assets/img/white.png";
import HoverXeyeSvg from "@/assets/img/loading.png";
import PipySvg from "@/assets/img/pipy-white.png";
import { useConfirm } from "primevue/useconfirm";
import ZtmService from '@/service/ZtmService';
import Apps from '@/views/apps/Apps.vue';
import AppService from '@/service/AppService';
import ShellService from '@/service/ShellService';
import { checkAuthorization } from "@/service/common/request";
import { isAdmin } from "@/service/common/authority-utils";
import { hostname } from '@tauri-apps/plugin-os';
import { invoke } from '@tauri-apps/api/core';
import { getPort } from '@/service/common/request';
import { openWebview } from '@/utils/webview';
import { fsInit, downloadFile } from '@/utils/file';
import { copy } from '@/utils/clipboard';
import toast from "@/utils/toast";

const store = useStore();
const playing = ref(false);
const loading = ref(false);
const version = computed(() => {
	return store.getters['account/version']
});
const ztmService = new ZtmService();
const appService = new AppService();
const shellService = new ShellService();
const confirm = useConfirm();
const props = defineProps(['embed']);
const emits = defineEmits(['collapse']);
const router = useRouter();
const logoHover = ref(false);

const platform = computed(() => {
	return store.getters['account/platform']
});
const user = computed(() => {
	return store.getters['account/user'];
});
const ztmVersion = computed(() => {
	return !!version.value?.ztm?.version? `${version.value?.ztm?.version}` : "";
});
const meshes = ref([]);
const placeholder = computed(() => {
	const _vs = "ZTM : ";
	const unit = 'Mesh';
	const units = 'Meshes';
	if(!!loading.value){
		return `Starting...`;
	} else if(!playing.value && errors.value > 0){
		return `${props.embed?'':_vs}Check for errors.`;
	} else if(!playing.value){
		return `${_vs}Off.`;
	} else if(!meshes.value || meshes.value.length ==0){
		return `${props.embed?'':_vs}First, join a ${unit}.`;
	} else if(meshes.value.length == 1){
		return `${_vs}1 ${unit} Joined.`;
	} else {
		return `${_vs}${meshes.value.length} ${meshes.value.length>1?units:unit} Joined.`;
	}
});

const selectedMesh = ref(null);
const changeMesh = (d) => {
	store.commit('account/setSelectedMesh', d?.value||d);
}

const storeMesh = computed(() => {
	return store.getters["account/selectedMesh"]
});
watch(()=>storeMesh,()=>{
	selectedMesh.value = storeMesh.value
},{
	deep:true
})
const timmer = () => {
	setInterval(()=>{
		loaddata(true);
	},6000)
}
const merged = ref(false)
const loaddata = (reload) => {
	if(!reload){
		loading.value = true;
	}
	ztmService.getMeshes()
		.then(res => {
			loading.value = false;
			if(!!res){
				playing.value = true;
				errors.value = [];
				meshes.value = res;
				store.commit('account/setMeshes', res);
			}
			if(!!res && res.length>0 && (!storeMesh.value || !meshes.value.find((mesh)=> mesh?.name == storeMesh.value?.name))){
				store.commit('account/setSelectedMesh', res[0]);
				selectedMesh.value = res[0];
			}
			if(!merged.value && playing.value && (res.length == 0 || true)){
				merged.value = true;
				ztmService.mergePrivateKey(()=>{})
			}
		})
		.catch(err => {
			loading.value = false;
			console.log('Request Failed', err)
		}); 
	takePipyVersion();
}
const play = () => {
	pipyPlay();
}

const pipyInit = async (pause) => {
	const hostname = await invoke("plugin:os|hostname");
	store.commit('account/setUser', {
		id: hostname
	});
	loading.value = true;
	setTimeout(() => {
		startPipy();
	},platform.value=='android'?600:300)
	setTimeout(() => {
		loaddata();
	},platform.value=='android'?2000:1500)
}
const pipyPlay = async () => {
	await startPipy();
	setTimeout(() => {
		loaddata();
	},300)
}

const errors = ref([]);
const errorMsg = computed(() => {
	let msg = '';
	errors.value.forEach((error, ei) => {
		if(ei>0){
			msg += '\n';
		}
		msg += `${error}`;
	});
	return msg;
})

const startPipy = async () => {
	await shellService.startPipy(getPort(), false, error => {
		errors.value.push(error);
		// console.error(`command error: "${error}"`)
	});
}
const pause = async () => {
	await shellService.pausePipy(getPort());
	playing.value = false;
}
const clickPause = () => {
	pause();
}

const logout = () => {
    confirm.require({
        message: 'Are you sure you want to exit?',
        header: 'Logout',
        icon: 'pi pi-exclamation-triangle',
        accept: () => {
					removeAuthorization(AUTH_TYPE.BASIC);
					store.commit('account/setUser', null);
          // router.push('/login');
        },
        reject: () => {
            
        }
    });
};
const clickCollapse = (path) => {
	router.push(path)
}
const goLogin = () => {
	router.push('/login');
}
const goConsole = () => {
	router.push('/mesh');
}
const restart = ref(false);

const appsOpen = ref(false);
const upload = (d)=>{
	console.log("upload start")
	if(!!d){
		try{
			const appJSON = JSON.parse(d);
			if(!appJSON.agent.name && !!user.value?.id && user.value?.id != 'Client'){
				appJSON.agent.name = user.value?.id
			}
			appService.newApp(appJSON,()=>{
				setTimeout(() => {
					loaddata();
				},platform.value=='android'?2000:1500)
			})
			console.log(config.value)
		}catch(e){
		}
	}
}

const choose_button_click = ()=>{
	setTimeout(()=>{
		const choose_button = document.querySelector(".p-fileupload-choose-button");
		console.log(choose_button)
		choose_button.click()
	},100)
} 
const joinMesh = () => {
	openWebview({
		url:'/#/mesh',
		name:'ZTMGui',
		width:1280,
		height:860,
		proxy:''
	});
	toggleLeft();
}
const takePipyVersion = () => {
	shellService.takePipyVersion();
}
const usermenu = ref();
const usermenuitems = computed(()=>[{
	label: user.value?.id,
	items: [
		{
				label: 'Copy Identity',
				icon: 'pi pi-copy',
				command(){
					ztmService.identity()
						.then(res => {
							if(!!res){
								copy(res)
							}
						})
						.catch(err => {
							loading.value = false;
							console.log('Request Failed', err)
						}); 
				},
		},
		{
				label: 'Download Identity',
				icon: 'pi pi-download',
				command(){
					ztmService.identity()
						.then(res => {
							if(!!res){
								downloadFile({
									data: res,
									fileName:`identity`,
									ext: "txt"
								});
							}
						})
						.catch(err => {
							loading.value = false;
							console.log('Request Failed', err)
						}); 
				},
		},
	]
}]);

const toggleUsermenu = (event) => {
    usermenu.value.toggle(event);
};
const toggleLeft = () => {
	store.commit('account/setMobileLeftbar', false);
}
onMounted(() => {
	pipyInit();
	timmer();
	fsInit();
});
</script>

<template>
	<Apps v-if="appsOpen" @close="() => appsOpen = false" layout="fixed_container"/>
	<div v-else class="e-card playing transparent-form" :class="{'blur': false,'android':platform=='android','ios':platform=='ios'}">
	  <div class="image"></div>
	  <div class="wave"></div>
	  <div class="wave"></div>
	  <div class="wave"></div>
		<PipyVersion class="left-fixed" :playing="playing"/>
		<div class="userinfo" v-if="user"  @click="toggleUsermenu">
			<Avatar icon="pi pi-user" style="background-color: rgba(255, 255, 2555, 0.5);color: #fff" shape="circle" />
			<span>{{user?.id}}</span>
		</div>
		<Menu ref="usermenu" id="user_menu" :model="usermenuitems" :popup="true" />
		<div class="infotop">
			<div>
				<img :class="{'spiner': playing,'bling2':!playing}" class="logo pointer" :src="playing?HoverXeyeSvg:XeyeSvg" />
			</div>
			<div>
				<!-- <FileImportSelector icon="pi pi-download" :path="``" class="pointer ml-2" placeholder="Import" @saved="()=>{}"></FileImportSelector> -->
			</div>
			<div class="mt-4">
				<Button v-if="!user" class="w-20rem" @click="goLogin">Login</Button>
				<Select 
				v-else
				:options="meshes" 
				optionLabel="name" 
				:filter="meshes.length>8"
				scrollHeight="7rem"
				v-model="selectedMesh"
				@change="changeMesh"
				:loading="loading"
				:placeholder="placeholder" 
				class="transparent">
				    <template #dropdownicon>
							<i v-if="!!errorMsg" v-tooltip.left="errorMsg" class="iconfont icon-warn text-yellow-500 opacity-90 text-2xl" />
							<i v-else v-tooltip="placeholder" class="pi pi-sort-down-fill text-white-alpha-70 text-sm" />
				    </template>
				    <template #option="slotProps">
				        <div class="flex align-items-center">
										<Status :run="slotProps.option.connected" :errors="slotProps.option.errors" />
				            <div>{{ decodeURI(slotProps.option.name) }}</div>
				        </div>
				    </template>
				    <template #empty>
							No mesh.
				    </template>
						<template #value="slotProps">
								<div  v-if="slotProps.value" class="flex align-items-center">
										<Status :run="slotProps.value.connected" :errors="slotProps.value.errors" />
										<div>{{ decodeURI(slotProps.value.name) }}</div>
								</div>
								<span v-else >
										{{ slotProps.placeholder }}
								</span>
						</template>
				</Select>
				
			</div>
			<div class="name mt-3 opacity-60">
				<Tag v-if="!!ztmVersion" :value="ztmVersion" />
			</div>
	  </div>
		
		<div class="footer">
<!-- 			<div v-if="user" class="flex-item">
				<Button  v-tooltip="'Logout'" class="pointer" severity="help" text rounded aria-label="Filter" @click="logout" >
					<i class="pi pi-power-off " />
				</Button>
			</div> -->

			<div class="flex-item" v-if="platform!='android' && platform!='ios'">
				<Button @click="joinMesh" v-tooltip="'Join Mesh'" class="pointer" severity="help" rounded text aria-label="Filter" >
					<i class="pi pi-plus text-3xl"  />
				</Button>
			</div>
			<div class="flex-item">
				<FileUploderSmall class="pointer" placeholder="Import Mesh | App" @upload="upload">
					<i class="pi pi-upload text-3xl"  />
				</FileUploderSmall>
			</div>
			<div class="flex-item" v-if="platform!='android' && platform!='ios'">
				<Button @click="() => appsOpen=true" v-tooltip="'Apps'" class="pointer" severity="help" rounded text aria-label="Filter" >
					<i class="pi pi-th-large text-3xl"  />
				</Button>
			</div>
			<div class="flex-item" v-if="platform!='android' && platform!='ios'">
				<Button v-tooltip.left="'Start'" v-if="!playing" class="pointer" severity="help" text rounded aria-label="Filter" @click="play" >
					<i class="pi pi-play " />
				</Button>
				<Button v-tooltip="'Pause'"  v-else class="pointer" severity="help" text rounded aria-label="Filter" @click="clickPause" >
					<i class="pi pi-stop-circle" />
				</Button>
			</div>
		</div>
	</div>
</template>

<style lang="scss" scoped>
	.log{
		opacity: 0.8;
		transition: .3s all;
	}
	.bling2{
		-webkit-animation: bling2 2s infinite linear;
		animation: bling2 2s infinite linear
	}
	.userinfo{
		text-align: right;
		position: absolute;
		top: 10px;
		right: 15px;
		color: rgba(255,255,255,0.7);
		font-weight: bold;
		text-overflow: ellipsis;
		max-width: 130px;
		overflow: hidden;
		white-space: nowrap;
	}
	.userinfo .p-avatar{
		vertical-align: middle;
		transform: scale(0.7);
	}
	.footer .pi,.footer .iconfont{
		font-size: 26px;
		color: rgba(255, 255, 255, 0.9);
		transition: .3s all;
		margin: auto;
	}
	.pi-cog:hover{
	}
	.e-card {
	  background-color: #af40ff;
	  box-shadow: 0px 8px 28px -9px rgba(0,0,0,0.45);
	  position: fixed;
		left: 0;
		right: 0;
		top: 0;
		bottom: 0;
		z-index: 0;
	  border-radius: 0px;
	  overflow: hidden;
	}
	.e-card.blur{
		filter: blur(10px);
	}
	.e-card .footer{
		display: flex;
		justify-content: center;
		align-items: center;
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 60px;
		background-color: rgba(255, 255, 255, 0.4);
	}
	.e-card .footer{
		padding-bottom: 12px;
		padding-top: 10px;
	}
	.e-card .footer .flex-item{
		text-align: center;
		height: 46px;
		line-height: 46px;
	}
	.e-card .footer .flex-item:not(:first-child){
		border-left:1px dashed rgba(255, 255, 255, 0.3);
	}
	.wave {
	  position: absolute;
	  width: 1400px;
	  height: 1400px;
	  opacity: 0.6;
	  left: 0;
	  top: 0;
	  margin-left: -115%;
	  margin-top: -20%;
	  background: linear-gradient(744deg,#af40ff,#5b42f3 60%,#00ddeb);
	}
	
	.icon {
	  width: 3em;
	  margin-top: -1em;
	  padding-bottom: 1em;
	}
	.logo{
		height: 60px;
		width: 60px;
	}
	.infotop {
	  text-align: center;
	  font-size: 20px;
	  position: fixed;;
	  top: 50%;
		margin-top: -80px;
	  left: 0;
	  right: 0;
	  color: rgb(255, 255, 255);
	  font-weight: 600;
		
	}
	
	.name {
	  font-size: 12px;
	  font-weight: 300;
		color: rgba(255, 255, 255, 0.5);
		.p-tag{
			transform: scale(0.8);
		}
	}
	
	.wave:nth-child(2),
	.wave:nth-child(3) {
	  top: 210px;
	}
	
	.playing .wave {
	  border-radius: 40%;
	  animation: wave 3000ms infinite linear;
	}
	
	.wave {
	  border-radius: 40%;
	  animation: wave 55s infinite linear;
	}
	
	.playing .wave:nth-child(2) {
	  animation-duration: 4000ms;
	}
	
	.wave:nth-child(2) {
	  animation-duration: 50s;
	}
	
	.playing .wave:nth-child(3) {
	  animation-duration: 5000ms;
	}
	
	.wave:nth-child(3) {
	  animation-duration: 45s;
	}
	
	@keyframes wave {
	  0% {
	    transform: rotate(0deg);
	  }
	
	  100% {
	    transform: rotate(360deg);
	  }
	}
	
	
	:deep(.footer .p-button){
		width: 46px;
		height: 46px;
		padding: 0;
		text-align: center;
	}
	
	.left-fixed{
		position: absolute;
		left: 15px;
		top: 12px;
	}
	.config-pannel{
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 3;
	}
	.config-body{
		position: relative;
		padding: 2rem;
		z-index: 4;
		color: rgba(255, 255, 255, 0.9);
	}
	.config-pannel:before {
	  content: "";
	  position: absolute;
	  top: 0;
	  left: 0;
	  right: 0;
	  bottom: 0;
	  background-color: rgba(175, 151, 251, 0.5);
	  backdrop-filter: blur(10px);
	}
	.config-body .close{
		position: absolute !important;
		right: 15px;
		top: 15px;
		color: rgba(255, 255, 255, 0.7);
	}
	.border-bottom-1{
		border-color:rgba(255,255,255,0.5) !important;
		border-bottom-style: dashed !important;
	}
	:deep(.transparent.p-select){
		width: 20rem;
	}
@media screen and (max-width: 768px){
	.android{
		.logo{
			height: 90px;
			width: 90px;
			opacity: 0.85;
			margin-bottom: 30px;
		}
		.infotop {
		  top: 30%;
			margin-top: 0px;
			
		}
		.transparent.p-select{
			width: 80%;
			line-height: 26px;
			font-size: 1.2rem;
		}
	}
	.ios{
		.logo{
			height: 90px;
			width: 90px;
			opacity: 0.85;
			margin-bottom: 30px;
		}
		.infotop {
		  top: 30%;
			margin-top: 0px;
			
		}
		.transparent.p-select{
			width: 80%;
			line-height: 26px;
			font-size: 1.2rem;
		}
	}
}
</style>
