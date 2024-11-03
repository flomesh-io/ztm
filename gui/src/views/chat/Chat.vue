<script setup>
import { ref, onMounted,onBeforeUnmount, onActivated, watch, computed } from "vue";
import style from '@/utils/style';
import { chatFileType } from '@/utils/file';
import ChatService from '@/service/ChatService';
import userSvg from "@/assets/img/user.png";
import systemSvg from "@/assets/img/system.png";
import _ from 'lodash';
import 'deep-chat';
import { useStore } from 'vuex';

/*
	{"files": [{
		src: "data:image/gif;base64...",
		ref: File{...}
		type: "image"
	},{
		src: "npm.txt",
		ref: File{...}
		type: "any"
	}], "role": "ai"},
*/
const store = useStore();
const chatService = new ChatService();
const props = defineProps(['room','endpointMap']);
const emits = defineEmits(['back','peer','manager','update:room']);
const user = computed(() => {
	return store.getters["account/selectedMesh"]?.agent?.username
});
const messages = ref({});
const history = ref([]);
const chat = ref();
const chatReady = ref(false)
const sendMessage = (e) => {
	if(!e.detail.isInitial){
		if(e.detail.message?.text){
			messages.value[`${e.detail.message?.role}-${e.detail.message?.text}`] = true;
		}
		if(e.detail.message?.files){
			e.detail.message.files.forEach((file)=>{
				messages.value[`${e.detail.message?.role}-${file?.ref?.name}`] = true;
			})
		}
	}
}

const getRoom = () => {
	const _group = props.room?.group;
	if(!!_group){
		chatService.getGroup(_group, props.room?.creator).then((res)=>{
			if(props.room?.group == _group){
				emits('update:room',res);
			}
		});
	}
}
const since = ref();
const getHistory = () => {
	if(props.room?.peer){
		return chatService.getPeerMsgs(props.room?.peer, since.value,null );
	} else {
		return chatService.getGroupMsgs(props.room?.group, props.room?.creator );
	}
}

const init = ref(false);
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
				default: {display: 'none'},
			}
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
	}
	if(!!item.message?.text){
		_msg.key = item.message?.text;
		_msg.html = item.message?.text;
	}
	if(!!item.message?.files?.length){
		_msg.files = []
		item.message.files.forEach((file)=>{
			const type = chatFileType(file.contentType);
			if(type == 'any'){
				_msg.html += style.templates.acceptFile({
					file, 
					src: chatService.getFileUrl(file, item.sender)
				})
			} else {
				_msg.files.push({
					type,
					name: file.name,
					src:chatService.getFileUrl(file, item.sender),
				})
			}
		})
	}
	
	return _msg;
}
const loaddataCore = (callback) => {
	getHistory().then(res=>{
		let _messages = [];
		if(!init.value){
			(res || []).forEach(item=>{
				const _msg = buildMessage(item);
				messages.value[`${_msg?.role}-${_msg?.id}`] = true;
				_messages.push(_msg)
			})
			history.value = _messages || [];
			init.value = true;
			
			// fetch('https://crates.io/assets/cargo.png').then((resp)=>{
			// 	resp.blob().then((blob)=>{
			// 		const objectURL = URL.createObjectURL(blob);
			// 		hashMap.value['aaa'] = objectURL;
			// 		console.log(objectURL)
			// 		// console.log(history.value[0])
			// 		// history.value[0].html += "";
			// 		history.value[0].files = [{"src": hashMap.value['aaa'], "type": "image"}]
			// 		setTimeout(()=>{
			// 			// chat.value.refreshMessages();
			// 		},2000)
			// 	})
			// });
			
		}else if(res && chat.value){
			const _messages = [];
			(res || []).forEach(item=>{
				
				const _msg = buildMessage(item);
				if(!!_msg?.key && messages.value[`${_msg?.role}-${_msg?.key}`]){
					messages.value[`${_msg?.role}-${_msg?.key}`] = false;
					messages.value[`${_msg?.role}-${_msg?.id}`] = true;
				} else if(!!_msg?.files && !!_msg.files[0] && messages.value[`${_msg?.role}-${_msg.files[0]?.name}`]){
					messages.value[`${_msg?.role}-${_msg.files[0]?.name}`] = false;
					messages.value[`${_msg?.role}-${_msg?.id}`] = true;
				} else if(!messages.value[`${_msg?.role}-${_msg?.id}`]){
					messages.value[`${_msg?.role}-${_msg?.id}`] = true;
					_messages.push(_msg)
				}
			})
			_messages.forEach((item)=>{
				chat.value.addMessage(item);
			})
		}
		if(!!chatReady.value){
			since.value = Date.now()-(3*1000);
			// chat.value.refreshMessages();
		}
		if(callback){
			callback()
		}
	});
}

const timer = ref(true)
const loaddataTimer = () => {
	loaddataCore(()=>{
		if(timer.value){
			setTimeout(()=>{
				loaddataTimer();
			},1000)
		}
	})
}
const loaddata = () => {
	if(!!chatReady.value){
		chat.value.clearMessages();
	}
	loaddataTimer();
}
const windowWidth = ref(window.innerWidth);
const isMobile = computed(() => windowWidth.value<=768);
const windowHeight = ref(window.innerHeight);
const viewHeight = computed(() => windowHeight.value - (isMobile.value?49:36));
const submitStyle = computed(() => style.submitStyle)
const micStyle= computed(()=>style.micStyle)
const menuStyle = computed(()=>style.menuStyle)
const inputStyle = computed(() => style.inputStyle(isMobile.value))
const hasMediaDevices = computed(() => false);
const postMessage = (message, callback) => {
	if(props.room?.peer){
		chatService.newPeerMsg(props.room?.peer, message, callback);
	} else {
		chatService.newGroupMsg(props.room?.group, props.room?.creator, message, callback);
	}
}
const chatRender = (e)=>{
	chat.value.scrollToBottom();
	chat.value.focusInput();
	if(!chatReady.value){
		chatReady.value = true;
		loaddata();
	}
	style.templates.initClass(chat.value);
}
const requestInterceptor = (requestDetails) => {
  // console.log(requestDetails); // printed above
	//requestDetails.body.messages[0].text
	// requestDetails.body.messages[0].html="xxxxxxx"
  // requestDetails.body = {prompt: "asd"}; // custom body
  return requestDetails;
};

const request = ref({
	handler: (body, signals) => {
		try {
			console.log("%%%%%%%")
			if (body instanceof FormData) {
				const message = { overwrite: true, files:[] }
				for (const [key, value] of body.entries()) {
				  console.log(`${key}: ${value}`);
					if(key == 'files'){
						message.files.push(value)
					}else if(key == 'message1'){
						message['text'] = value;
					}
				}
				
				// let html = "";
				// message?.files.forEach((file)=>{
				// 	const type = chatFileType(file.type);
				// 	if(type == 'any'){
				// 		html += style.templates.acceptFile({
				// 			file,
				// 			src:''
				// 		})
				// 	}
				// })
				// if(!!html){
				// 	signals.onResponse({role: 'user',html:html,overwrite: true});
				// } else {
				// 	signals.onResponse({files:[],overwrite: true});
				// }
				
				postMessage(message,(body)=>{
					let html2 = "";
					body?.files.forEach((file)=>{
						const type = chatFileType(file.contentType);
						if(type == 'any' && file.hash){
							html2 += style.templates.acceptFile({
								file,
								src:chatService.getFileUrl(file, user.value)
							})
						}
					})
					signals.onResponse({files:[],overwrite: true});
					if(!!html2){
						// signals.onResponse({role: 'user',html:html2,overwrite: true});
						chat.value.addMessage({role: 'user',html:html2},false);
					}
				});
			}else if(body?.messages){
				if(body?.messages[0]){
					postMessage(body?.messages[0],()=>{
						signals.onResponse({...body?.messages[0],overwrite: true});
					});
				}else{
					signals.onResponse({error: 'No message'});
				}
			}else{
				signals.onResponse({error: 'No message'});
			}
		} catch (e) {
			signals.onResponse({error: 'Error'}); // displays an error message
		}
	}
})

const names = computed(() => style.nameStyle(user.value, isMobile.value))
const avatars = computed(() => {
	return {
		system: {"src": systemSvg,"styles":style.avatarStyle},
		default: {"src": userSvg,"styles":style.avatarStyle},
		ai: {"src": userSvg,"styles":style.avatarStyle}
	};
})

const manage = ref(false);
const showManage = () => {
	emits('manager',true);
}
const back = () => {
	emits('back')
}
const openPeer = () => {
	emits('peer',props.room?.peer);
}
onMounted(()=>{
	// loaddata()
	getRoom();
})

onBeforeUnmount(()=>{
	timer.value = false;
})
</script>

<template>
	<AppHeader :back="back">
	    <template #center v-if="props.room?.peer">
				<Status :run="true" />
	      <b>{{props.room?.peer}}</b>
	    </template>
	    <template #center v-else>
	      <b>{{props.room?.name}}</b>
	    </template>
	    <template #end> 
				<Button v-if="props.room?.peer" icon="pi pi-ellipsis-h" @click="showManage" severity="secondary" text />
				<Button v-else icon="pi pi-ellipsis-h" @click="showManage" severity="secondary" text />
			</template>
	</AppHeader>
	<div class="w-full flex" style="height: calc(100vh - 37px);flex: 1;margin: 0;flex-direction: column;">
	<deep-chat
		:textToSpeech='{"volume": 0.9}'
		ref="chat"
		:names="names"
		@render="chatRender"
		@new-message="sendMessage"
		:attachmentContainerStyle='style.attachmentContainerStyle()'
		:avatars='avatars'
		:dragAndDrop='style.dragAndDrop()'
		:style='style.chatTheme(viewHeight)'
	  v-model:history="history"
		:displayLoadingBubble="false"
		:htmlClassUtilities="htmlClassUtilities()"
		:messageStyles='style.messageStyles()'
		:inputAreaStyle='style.inputAreaStyle()'
		:textInput="inputStyle"
		:auxiliaryStyle="style.auxiliaryStyle()"
		:dropupStyles='style.dropupStyles()'
		:demo='{"displayLoadingBubble": false}'
		:stream="false"
		:connect="request"
		:requestInterceptor="requestInterceptor"
		:submitButtonStyles="submitStyle('inside-right','10px')"
		:microphone="hasMediaDevices?micStyle('inside-right','40px'):false"
		:mixedFiles="menuStyle('inside-left','40px')"
		:images="menuStyle('inside-left','10px')"
		:camera="hasMediaDevices?menuStyle('inside-left','70px'):false"
	  />
	</div>
</template>

<style lang="scss">
	#container{
		height: 100%;
	}
	.outside-left{
		bottom: 1em !important;
	}
	
</style>