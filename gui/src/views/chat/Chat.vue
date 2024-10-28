<script setup>
import { ref, onMounted,onBeforeUnmount, onActivated, watch, computed } from "vue";
import style from '@/utils/style';
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
		messages.value[`${e.detail.message?.role}-${e.detail.message?.text}`] = true;
		console.log(e.detail.message)
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
const loaddataCore = (callback) => {
	getHistory().then(res=>{
		let _messages = [];
		if(!init.value){
			(res || []).forEach(item=>{
				const _msg = {
					id:item.time,
					text:item.message?.type == 'text'?item.message?.content:'',
					endpoint:item.sender,
					role: user.value != item.sender?item.sender:'user'
				}
				messages.value[`${_msg?.role}-${_msg?.id}`] = true;
				_messages.push(_msg)
			})
			history.value = _messages || [];
			init.value = true;
		}else if(res && chat.value){
			const _messages = [];
			(res || []).forEach(item=>{
				const _msg = {
					id:item.time,
					text:item.message?.type == 'text'?item.message?.content:'',
					endpoint:item.sender,
					role: user.value != item.sender?item.sender:'user'
				}
				if(messages.value[`${_msg?.role}-${_msg?.text}`]){
					messages.value[`${_msg?.role}-${_msg?.text}`] = false;
					messages.value[`${_msg?.role}-${_msg?.id}`] = true;
				} else if(!messages.value[`${_msg?.role}-${_msg?.id}`]){
					messages.value[`${_msg?.role}-${_msg?.id}`] = true;
					_messages.push(_msg)
				}
			})
			_messages.forEach((item)=>{
				chat.value.addMessage({
					html: item.text,
					role: item.role,
				});
			})
		}
		if(!!chatReady.value){
			since.value = Date.now()-(10*1000);
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
			},3000)
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
const postMessage = async (body) => {
	if(props.room?.peer){
		return chatService.newPeerMsg(props.room?.peer, body );
	} else {
		return chatService.newGroupMsg(props.room?.group, props.room?.creator, body );
	}
}
const joinMessage = ()=>{
	postMessage({  type: "text",content: `Welcome '${user.value}' to join the chat room.` }).then(res=>{
		loaddata();
	});
}
const chatRender = (e)=>{
	chat.value.scrollToBottom();
	chat.value.focusInput();
	if(!chatReady.value){
		chatReady.value = true;
		loaddata();
	}
}
const request = ref({
	handler: (body, signals) => {
		try {
			if(body?.messages[0]){
				postMessage({
					type: 'text',
					content: body?.messages[0]?.text
				}).then(res=>{
					// loaddataCore();
					signals.onResponse({...body?.messages[0],overwrite: true});
				});
			}else{
				signals.onResponse({error: 'No message'});
			}
		} catch (e) {
			signals.onResponse({error: 'Error'}); // displays an error message
		}
	}
})

const names = computed(() => style.nameStyle(user.value))
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
		:messageStyles='style.messageStyles()'
		:inputAreaStyle='style.inputAreaStyle()'
		:textInput="inputStyle"
		:auxiliaryStyle="style.auxiliaryStyle()"
		:dropupStyles='style.dropupStyles()'
		:demo='{"displayLoadingBubble": false}'
		:stream="false"
		:connect="request"
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