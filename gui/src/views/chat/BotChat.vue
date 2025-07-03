<script setup>
import { ref, onMounted,onBeforeUnmount, onActivated, watch, computed } from "vue";
import style from '@/utils/style';
import { chatFileType, writeMobileFile,folderInit,openFile,openFolder } from '@/utils/file';
import BotService from '@/service/BotService';
import MCPService from '@/service/MCPService';
import userSvg from "@/assets/img/user.png";
import botSvg from "@/assets/img/bot.svg";
import { platform, isMobileWidth } from '@/utils/platform';
import { getItem, setItem, pushItem, STORE_SETTING_MCP,STORE_BOT_HISTORY } from "@/utils/localStore";
import _ from 'lodash';
import 'deep-chat';
import { useStore } from 'vuex';
import { useI18n } from 'vue-i18n';
import { generateList } from "@/utils/svgAvatar";
import ToolCallCard from "./ToolCallCard.vue"

const { t } = useI18n();

const llm = ref(null);
const mcps = ref([]);
const loading = ref(true);
const store = useStore();
const botService = new BotService();
const mcpService = new MCPService();
const props = defineProps(['room']);
const emits = defineEmits(['back','peer','manager','history','notify','update:room']);
const selectedMesh = computed(() => {
	return store.getters["account/selectedMesh"]
});
const user = computed(() => {
	return store.getters["account/selectedMesh"]?.agent?.username
});
const messages = ref({});
const history = ref([]);
const chat = ref();
const chatReady = ref(false)

const pusher = computed(()=>store.getters["mcp/messages"])

const sendMessage = (e) => {
	if(!e.detail.isInitial){
		if(e.detail.message?.text){
			messages.value[`${e.detail.message?.role}-${e.detail.message?.text}`] = true;
		}
		if(e.detail.message?.files){
			// e.detail.message.files.forEach((file)=>{
			// 	messages.value[`${e.detail.message?.role}-${file?.ref?.name}`] = true;
			// })
		}
	}
}
const toolcallTarget = ref({})
const lastmsg = ref('');
const msgHtml = (msg, toolcall) => {
	if(toolcall?.status == 'before') {
		toolcallTarget.value = toolcall;
		lastmsg.value = msg;
		let filterMsg = msg.replace(/```json[^`]*```/,t("Do you want to execute a tool call?")) || t("Do you want to execute a tool call?");
		return `<pre style="white-space: pre-wrap;word-wrap: break-word;overflow-wrap: break-word;background:transparent;color:var(--p-text-color);margin:0;"><div>${filterMsg}</div></pre>
		<div style="display: flex;text-align:right;padding:10px">
			<button class="toolcall-no-button">${t("No")}</button>
			<button class="toolcall-edit-button">${t("Edit")}</button>
			<button class="toolcall-yes-button">${t("Yes")}</button>
		</div>`
	} else if(toolcall?.status == 'progress') {
		let filterMsg = msg.replace(/```json[^`]*```/,t("Requesting task ...")) || t("Requesting task ...");
		return `<pre style="white-space: pre-wrap;word-wrap: break-word;overflow-wrap: break-word;background:transparent;color:var(--p-text-color);margin:0;"><div>${filterMsg}</div></pre>`
	} else if(toolcall?.status == 'cancel') {
		let filterMsg = msg.replace(/```json[^`]*```/,t("Task aborted.")) || t("Task aborted.");
		return `<pre style="white-space: pre-wrap;word-wrap: break-word;overflow-wrap: break-word;background:transparent;color:var(--p-text-color);margin:0;"><div>${filterMsg}</div></pre>`
	} else {
		return `<pre style="white-space: pre-wrap;word-wrap: break-word;overflow-wrap: break-word;background:transparent;color:var(--p-text-color);margin:0;">${msg}</pre>`;
	} 
}
const openToolcallEditor = ref(false);
const makeToolcall = () => {
	openToolcallEditor.value = false;
	toolcallTarget.value.status = "progress"
	toolcallTarget.value.execute(toolcallTarget.value.tool_calls);
}
const cancelToolcall = () => {
	openToolcallEditor.value = false;
	toolcallTarget.value.status = "cancel"
	callbackProxy(
		msgHtml(lastmsg.value, toolcallTarget.value),
		false,
		true
	);
	toolcallTarget.value.cancel()
}
const getHistory = () => {
	getItem(STORE_BOT_HISTORY(selectedMesh.value?.name,props?.room?.id),(res)=>{
		history.value = !!res && res.length>0 ? res : [{html:msgHtml('有什么可以帮助您？'), role:'ai'}];
	});
}
const appendHistory = ref([]);
const setHistory = (msg) => {
	appendHistory.value.push(msg);
	const newHis = history.value.concat(appendHistory.value);
	if(newHis.length>50){
		newHis.splice(0,newHis.length-50);
	}
	setItem(STORE_BOT_HISTORY(selectedMesh.value?.name,props?.room?.id),newHis,(res)=>{});
}

const init = ref(false);
const openToolcall = () => {
	openToolcallEditor.value = true;
	loaddata();
	setTimeout(()=>{
		callbackProxy(
			msgHtml(lastmsg.value, toolcallTarget.value),
			false,
			false
		);
	},300)
}
//any-file-message-bubble
const htmlClassUtilities = () => {
	return {
		['any-file-message-bubble']: {
			events: {
				click: (event) => (
					alert(event.target.title)
				)
			},
			styles: {
				default: {display: 'none'}
			}
		},
		
		['toolcall-yes-button']: {
			events: {
				click: (event) => {
					const parent = event.target.parentNode;
					parent.removeChild(parent.querySelector(".toolcall-edit-button"));
					parent.removeChild(parent.querySelector(".toolcall-no-button"));
					event.target.innerText = t('Running');
					makeToolcall();
					event.preventDefault();
				}
			},
			styles: {
				default: {cursor: 'pointer',border:'1px solid green',borderRadius:'6px',background: 'transparent'},
				hover: {opacity: 0.8},
				click: {opacity: 0.8}
			},
		},
		['toolcall-edit-button']: {
			events: {
				click: (event) => {
					openToolcall();
					event.preventDefault();
				}
			},
			styles: {
				default: {cursor: 'pointer',border:'1px solid orange',borderRadius:'6px',marginRight:'10px',background: 'transparent'},
				hover: {opacity: 0.8}
			},
		},
		['toolcall-no-button']: {
			events: {
				click: (event) => {
					cancelToolcall();
					event.preventDefault();
				}
			},
			styles: {
				default: {cursor: 'pointer',border:'1px solid #d80000',borderRadius:'6px',marginRight:'10px',background: 'transparent'},
				hover: {opacity: 0.8}
				// hover: {backgroundColor: 'yellow'},
			},
		},
		['download-button']: {
			events: {
				click: (event) => (
					alert(event.target.title)
				)
			},
			styles: {
				default: {cursor: 'pointer'},
				// hover: {backgroundColor: 'yellow'},
			},
		},
	}
}
const hashMap = ref({});
const buildMessage = (item) => {
	const _msg = {
		id:item.time,
		html: '',
		// html:`<button class="download-button" title="sdkbqwkejnqwkjehkqweh">test2</button>`,
		endpoint:item.sender,
		role: user.value != item.sender?item.sender:'user'
		// role: item.sender
	}
	if(!!item.message?.text){
		_msg.key = item.message?.text;
		_msg.html = item.message?.text;
	}
	// if(!!item.message?.files?.length){
	// 	_msg.files = []
	// 	item.message.files.forEach((file)=>{
	// 		if(file && file.size>0){
	// 			const type = chatFileType(file.contentType);
	// 			if(type == 'any'){
	// 				_msg.html += style.templates.acceptFile({
	// 					file, 
	// 					src: chatService.getFileUrl(file, item.sender),
	// 					mesh: selectedMesh.value?.name, 
	// 					base: props.room?.peer || props.room?.group,
	// 				})
	// 			} else if(type == 'video'){
	// 				const srcName = chatService.getFileUrl(file, item.sender);
	// 				file.src = `${srcName}.${file.contentType.split("/")[1]}`;
	// 				_msg.html += style.templates.video({ file, src: file.src });
	// 			} else {
	// 				const src = chatService.getFileUrl(file, item.sender);
	// 				const _n = {
	// 					type,
	// 					name: file.name,
	// 					src,
	// 				};
	// 				if(chatService.isBlob(type)){
	// 					_n.src = `${_n.src}.${file.contentType.split("/")[1]}`;
	// 				}
	// 				_msg.files.push(_n)
	// 			}
	// 		}
	// 	})
	// }
	return _msg;
}
const loaddata = () => {
	if(!!chatReady.value){
		chat.value.clearMessages();
	}
	getHistory();
}
const isMobile = computed(isMobileWidth);
const windowHeight = ref(window.innerHeight);
const viewHeight = computed(() => windowHeight.value - (isMobile.value?49:36));
const submitStyle = computed(() => style.submitStyle)
const micStyle= computed(()=>style.micStyle)
const menuStyle = computed(()=>style.menuStyle)
const inputStyle = computed(() => {
	let _style = style.inputStyle(isMobile.value);
	_style.placeholder.text = t(_style.placeholder.text)
	return _style;
})
const hasMediaDevices = computed(() => true);
const delta = ref('');
let callbackProxy = null;
const workerOnMessage = (msg) => {
	const toolcall = store.getters["mcp/toolcall"]
	if(msg?.message){
		callbackProxy(
			msgHtml(msg?.message, toolcall),
			true
		);
	} else {
		setTimeout(()=>{
			callbackProxy(
				msgHtml(msg?.delta, toolcall),
				msg?.ending,
				!msg?.first
			);
		},100);
	}
}
watch(()=> pusher.value, () => {
	if(pusher.value.length>0){
		pusher.value.forEach((message)=>{
			workerOnMessage(message)
		});
		store.commit('mcp/setMessages', []);
	}
}, { immediate: true,deep:true });
const postMessage = (message) => {
	if(message != ''){
		loading.value = true;
		setHistory(message);
		store.dispatch('mcp/worker', {
			roomId: props?.room?.id,
			mesh: selectedMesh.value?.name,
			message,
			llm: llm.value, 
			mcps: mcps.value,
		});
	}
}
const forwardTarget = ref();
const menuOpen = ref(false);
const chatRender = (e)=>{
	chat.value.scrollToBottom();
	chat.value.focusInput();
	if(!chatReady.value){
		chatReady.value = true;
		loaddata();
	}
	style.templates.initClass(chat.value);
	chat.value.addEventListener('forward', (e)=>{
		forwardTarget.value = e.detail;
		menuOpen.value = true;
	});
}
const forwardOpen = ref(false);
const forwardMessage = ref({})
const menus = computed(()=>{
	return [{
		label: (platform() == 'ios' || platform() == 'android') ? 'Share':'Open',
		icon: 'pi pi-external-link',
		click(){
			menuOpen.value = false;
			openFile(forwardTarget.value.url, forwardTarget.value.contentType)
		}
	},{
		label: 'Folder',
		hide: platform() == 'ios' || platform() == 'android' || platform() == 'web' || !platform(),
		icon: 'pi pi-folder-open',
		click(){
			menuOpen.value = false;
			const mesh = selectedMesh.value?.name;
			const base = llm.value?.name;
			openFolder(`ztmChat/${mesh}/${base}`)
		}
	},{
		label: 'Forward',
		icon: 'pi pi-reply',
		click(){
			menuOpen.value = false;
			forwardMessage.value = {
				files:[{
					name: forwardTarget.value.name,
					size: forwardTarget.value.size,
					contentType: forwardTarget.value.contentType,
					hash: forwardTarget.value.hash,
				}]
			};
			setTimeout(()=>{
				forwardOpen.value = true;
			},300)
		}
	}]
})
const requestInterceptor = (requestDetails) => {
  return requestDetails;
};
const request = ref({
	handler: (body, signals) => {
			if (body instanceof FormData) {
				const message = { overwrite: true, files:[] }
				for (const [key, value] of body.entries()) {
				  console.log(`${key}: ${value}`);
					if(key == 'files'){
						if(value && value?.size>0){
							message.files.push(value)
						}
					}else if(key == 'message1'){
						message['text'] = value;
					}
				}
				
				let html = "";
				let firstFile =  null;
				message?.files.forEach((file)=>{
					// writeMobileFile('beforePostMessageType.txt',`${file.name}/${file.type}`);
					const type = chatFileType(file.type);
					if(type == 'any'){
						html += style.templates.acceptFile({
							file,
							src:''
						})
						if(!firstFile){
							firstFile = file
						}
					} else if(type == 'video'){
						html += style.templates.video({
							file,
							src:''
						})
						if(!firstFile){
							firstFile = file
						}
					} 
				})
				signals.onResponse({files:[],overwrite: true});
				if(message?.files?.length>0){
					messages.value[`user-${message?.files[0].name}`] = true;
				}
				if(!!html){
					if(firstFile){
						messages.value[`user-${firstFile.name}`] = true;
					}
					// writeMobileFile('postMessageHTML.txt',html);
					chat.value.addMessage({role: 'user',html:html},false);
				}
				callbackProxy = (html2,ending)=>{
					//body
					// let html2 = "";
					// body?.files.forEach((file)=>{
					// 	// writeMobileFile('postMessageType.txt',`${file.name}/${file.contentType}`);
					// 	const type = chatFileType(file.contentType);
					// 	if(file.hash){
					// 		const src = '';//chatService.getFileUrl(file, user.value);
					// 		if(type == 'any'){
					// 			html2 += style.templates.acceptFile({
					// 				file,
					// 				src,
					// 				mesh: selectedMesh.value?.name, 
					// 				base: props.room?.peer || props.room?.group
					// 			})
					// 		} else if(type == 'video'){
					// 			html2 += style.templates.video({ file, src: `${src}.${file.contentType.split("/")[1]}` });
					// 		}
					// 	}
					// })
					// signals.onResponse({files:[],overwrite: true});
					if(!!html2){
						// signals.onResponse({role: 'user',html:html2,overwrite: true});
						
						setHistory({html:html2,role: 'ai'});
						chat.value.addMessage({html:html2,role: 'ai',overwrite: false},true);
						chat.value.scrollToBottom();
						emits('notify')
					}
				}
				postMessage(message);
			}else if(body?.messages){
				
				if(body?.messages[0]){
					callbackProxy = (html,ending,overwrite) => {
						// loading.value = false;
						signals.onResponse({files:[],overwrite: true});
						chat.value.addMessage({html,role: 'ai',overwrite: overwrite},overwrite);
						chat.value.scrollToBottom();
						if(ending){
							if(html.indexOf('"toolcall-yes-button"')==-1){
								setHistory({html,role: 'ai'});
							}
							signals.onResponse({files:[],overwrite: false});
							emits('notify')
						}
					}
					postMessage(body?.messages[0]);
				}else{
					signals.onResponse({error: 'No message'});
				}
			}else{
				signals.onResponse({error: 'No message'});
			}
		// } catch (e) {
		// 	signals.onResponse({error: 'Error'}); // displays an error message
		// }
	}
})

const names = computed(() => style.nameStyle(user.value, isMobile.value))
const renderAvatars = async (_users) => {
	const reqs = [];
	_users.forEach((u)=>{
		if(!store.getters['account/avatars'][u]){
			reqs.push(u);
		}
	})
	if(reqs.length>0){
		const avatarList = await generateList(reqs);
		avatarList.forEach((avatarNode)=>{
			store.commit('account/setAvatar', avatarNode);
		})
	}
}
const avatars = ref([]) 

const manage = ref(false);
const showManage = () => {
	emits('manager',true);
}
const back = () => {
	store.commit('mcp/setNotice', true);
	emits('back')
}
const openPeer = () => {
	emits('peer',llm.value?.name);
}

const loadllm = (callback) => {
	botService.checkLLM(props?.room?.id,(res) => {
		llm.value = res;
		if(callback){
			callback();
		}
	});
}
watch(()=>llm.value, async (newQuery) => {
	const _users = [user.value];
	if(_users && _users.length>0){
		await renderAvatars(_users);
		const customCss = {
			...style.avatarStyle?.avatar,
			"top":'0',
			"marginLeft": "0",
			"marginRight": "0",
		}
		let res = {
			system: {"src": botSvg,"styles":{avatar:{...customCss}}},
			default: {"src": botSvg,"styles":{avatar:{...customCss}}},
			ai: {"src": botSvg,"styles":{avatar:{...customCss,borderRadius:'0px'}}}
		}
		_users.forEach((u)=>{
			res[u == user.value ? 'user': u] = {"src": store.getters['account/avatars'][u],"styles":{avatar:{...customCss}}};
		})
		avatars.value = res;
	}
}, { immediate: true,deep:true });

const connectMcps = () => {
	//'http://localhost:1420/sse',//
	store.dispatch('mcp/stopAll');
	for(let i=0;i<mcps.value.length;i++){
		const mcp=mcps.value[i];
		
		mcpService.connectToServer({
			name: mcp.name,
			url: botService.getFullSvcUrl(`/svc/${mcp.kind}/${mcp.name}`),
			type: 'stream',
		});
	}
}

const loadLocalMcp = () => {
	getItem(STORE_SETTING_MCP(selectedMesh.value?.name,props?.room?.id),(res)=>{
		mcps.value = (res || []).filter((n)=> n.enabled == true);
		connectMcps();
	});
}

const setBot = (val) => {
	llm.value = val?.llm;
	mcps.value = val?.mcps;
	connectMcps();
}

onMounted(()=>{
	
	store.commit('mcp/setToolcall', null);
	store.commit('mcp/setNotice', false);
	loadllm(()=>{
		folderInit(['ztmChat',selectedMesh.value?.name], llm.value?.name);
		// loading.value = true;
	});
	loadLocalMcp();
})
const gohistory = () => {
	emits('history',true);
}
defineExpose({
  setBot
})
</script>

<template>
	<AppHeader :back="back">
	    <template #center >
				<Status :run="true" />
	      <b>{{props?.room?.name}} ({{llm?.name||t('No LLM')}})</b>
	    </template>
	    <template #end> 
				<Button icon="pi pi-history" @click="gohistory" severity="secondary" text />
				<Button icon="pi pi-cog" @click="showManage" severity="secondary" text />
			</template>
	</AppHeader>
	<div class="w-full flex" style="height: calc(100vh - 37px);flex: 1;margin: 0;flex-direction: column;">
		<deep-chat
			:textToSpeech='{"volume": 2}'
			ref="chat"
			:names="false"
			@render="chatRender"
			@new-message="sendMessage"
			:attachmentContainerStyle='style.attachmentContainerStyle()'
			:avatars='avatars'
			:dragAndDrop='style.dragAndDrop()'
			:style='style.chatTheme(viewHeight)'
			v-model:history="history"
			:displayLoadingBubble="true"
			:htmlClassUtilities="htmlClassUtilities()"
			:messageStyles='style.messageStyles()'
			:inputAreaStyle='style.inputAreaStyle()'
			:textInput="inputStyle"
			:auxiliaryStyle="style.auxiliaryStyle()"
			:dropupStyles='style.dropupStyles()'
			:demo='{"displayLoading": {"history": {"full": false},"message": loading}}'
			:stream="true"
			:connect="request"
			:requestInterceptor="requestInterceptor"
			:submitButtonStyles="submitStyle('inside-right','10px')"
			:microphone="hasMediaDevices?micStyle('inside-right','40px'):false"
			:mixedFiles="menuStyle('inside-left','40px')"
			:images="menuStyle('inside-left','10px')"
			:camera="hasMediaDevices?menuStyle('inside-left','70px'):false"
			/>
	</div>
	<Dialog class="noheader" v-model:visible="openToolcallEditor" modal :style="{ minHeight:'400px',minWidth:'400px'  }">
		<AppHeader :back="() => openToolcallEditor = false" :main="false">
				<template #center>
					<b>{{t('Modify Toolcalls')}} <Badge class="ml-2 relative" style="top:-2px" v-if="toolcallTarget.tool_calls.length>0" :value="toolcallTarget.tool_calls.length"/></b>
				</template>
		
				<template #end> 
					<Button icon="pi pi-caret-right" @click="makeToolcall" />
				</template>
		</AppHeader>
		<ToolCallCard v-model:toolcalls="toolcallTarget.tool_calls"/>
	</Dialog>
	<DrawMenu :menus="menus" v-model:open="menuOpen" :title="forwardTarget?.name"/>
	<Forward v-model:open="forwardOpen" :message="forwardMessage" />
</template>

<style lang="scss" >
	// #container{
	// 	height: 100%;
	// }
	// .outside-left{
	// 	bottom: 1em !important;
	// }
	
</style>