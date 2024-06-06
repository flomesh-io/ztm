<script setup>
import { ref, computed } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
		
const router = useRouter();
const store = useStore();
const logs = computed(() => {
	return store.getters['account/logs']
});
const props = defineProps(['apps']);
const emits = defineEmits(['close']);
const hide = () => {
	emits('close','')
}
const clear = () => {
}
const pages = computed(()=>{
	const _pages = Math.ceil((props.apps||[]).length/8);
	return _pages>0?new Array(_pages):[];
});
const appPageSize = 8;
const appPage = computed(()=>(page)=>{
	return (props.apps||[]).filter((n,i) => i>=page*appPageSize && i< (page+1)*appPageSize);
})
const openWebview = (app)=>{
	const proxy = "socks5://"+(app?.port?.listen?.ip||'127.0.0.1')+':'+app?.port?.listen?.port;
	store.commit('webview/setTarget', {
		icon: app.icon,
		name: app.name,
		url: app.url,
		proxy,
	});
	
	try{
		// const appWindow = new Window(`${app.name}-window`);
		const webview = new WebviewWindow(`${app.name}-webview`, {
			url: app.url,
			proxyUrl: proxy,
			title: `${app.name} ${proxy}=>${app.url}`,
			width:960
		});
		webview.once('tauri://created', function (d) {
			console.log('tauri://created')
			console.log(d)
		// webview successfully created
		});
		webview.once('tauri://error', function (e) {
			console.log('tauri://error')
			console.log(e)
		// an error happened creating the webview
		});
	}catch(e){
		console.log(e)
	}
	
}
const target = computed(()=>{
	return store.getters['webview/target']
})
</script>

<template>
	<ScrollPanel class="container">
	<div class="container_pannel">
	    <div class="container_terminal"></div>
			<div class="flex actions">
				<Button  v-tooltip.left="'Close'"  severity="help" text rounded aria-label="Filter" @click="hide" >
					<i class="pi pi-times " />
				</Button>
			</div>
	    <div class="terminal_body py-2 px-4" v-if="pages.length > 0">
				<Carousel :showNavigators="false" :value="pages" :numVisible="1" :numScroll="1" >
						<template #item="slotProps">
							<div class="pt-5" style="min-height: 250px;">
								<div class="grid text-center" >
										<div @click="openWebview(app)" class="col-3 py-4" v-for="(app) in appPage(slotProps.index)">
											<img :src="app.icon" class="pointer" width="40" height="40" style="border-radius: 4px; overflow: hidden;"/>
											<div class="mt-1">
												<b class="text-white opacity-90">{{app.name}}</b>
											</div>
										</div>
								</div>
							</div>
						</template>
				</Carousel>
	    </div>
	    <div class="terminal_body px-4 text-white-alpha-70 text-3xl text-center" style="padding-top: 25%;" v-else>
				First, import an App
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
		position: fixed;
		top: 5px;
		right: 10px;
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
