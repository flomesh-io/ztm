<script setup>
import { ref, onMounted,onActivated,watch, computed } from "vue";
import { useStore } from 'vuex';
import Chat from "./Chat.vue"
import BotChat from "./BotChat.vue"
import Setting from './Setting.vue'
import BotHistory from './BotHistory.vue'
import BotSetting from './BotSetting.vue'
import History from './History.vue'
import { dayjs, extend } from '@/utils/dayjs';
import { useRouter,useRoute } from 'vue-router'
import ChatService from '@/service/ChatService';
import ZtmService from '@/service/ZtmService';
import { platform } from '@/utils/platform';
import gptSvg from "@/assets/img/gpt.png";
import { resize, position } from "@/utils/window";
import _ from "lodash";
import { useI18n } from 'vue-i18n';
import { isMobileWidth } from '@/utils/platform';
const { t, locale } = useI18n();
extend(locale.value)
const props = defineProps(['app']);
const emits = defineEmits(['close'])
const store = useStore();
const router = useRouter();
const route = useRoute();
const chatService = new ChatService();
const ztmService = new ZtmService();
const selectedMesh = computed(() => {
	return store.getters["account/selectedMesh"]
});

const aiRooms = computed(() => {
	const rtn = [];
	(store.getters["mcp/rooms"] || []).forEach((r,index)=>{
		rtn.push({
			...r,
			index,
			bot: true,
		})
	});
	return rtn;
});
const rooms = computed(() => store.getters["notice/rooms"]);
const uniRooms = computed(() => {
	let rtn = _.cloneDeep((rooms.value||[]).concat(aiRooms.value));
	let index = rtn.findIndex(item => item.peer == selectedMesh.value?.agent?.username);
	if (index != -1) {
	  let node = rtn.splice(index, 1)[0];
	  rtn.unshift(node);
	} else {
		rtn.unshift({
			peer: selectedMesh.value?.agent?.username,
			latest:{
				message:{
					text:t('My Room.'),
				},
				time: Date.now()
			}
		})
	}
	return rtn.sort((a,b)=>a?.latest?.time - b?.latest?.time);
});
const unread = computed(() => {
	return store.getters["notice/unread"];
});
const isMobile = computed(isMobileWidth);
const read = (updated) => {
	const _unread = unread.value - updated
	store.commit('notice/setUnread',_unread >0?_unread:0);
}

const loadrooms = () => {
	store.dispatch('notice/rooms');
}
const load = () => {
	loadrooms();
}
const handleFileUpload = (file) => {
}
const windowHeight = ref(window.innerHeight);
const viewHeight = computed(() => windowHeight.value - 45);
const timeago = computed(() => (ts) => {
	const date = new Date(ts);
	return dayjs(date).fromNow();
})
const selectRoom = ref();
const selectPeer = ref();
const visibleUserSelector = ref(false);
const selectedNewChatUsers = ref({});
const newChat = () => {
	const users = Object.keys(selectedNewChatUsers.value);
	let _room = null;
	if(!!users && users.length > 1){
		const members = users.concat([selectedMesh.value?.agent?.username]);
		const roomid = members.join(",");
		const roomname = roomid.length >20?`${roomid.substr(0,20)}...`:roomid;
		selectedNewChatUsers.value = {};
		visibleUserSelector.value = false;
		chatService.newGroup({
			name:roomname, 
			members, 
			callback(res){
				_room = res;
				chatService.newGroupMsg(res?.group, res?.creator, {
					text: `Hello everyone, the group chat has been created.`
				})
			}
		});
	} else {
		selectedNewChatUsers.value = {};
		visibleUserSelector.value = false;
		const findroom = uniRooms.value.find(room => room.peer == users[0]);
		if(findroom){
			_room = findroom;
		}else{
			_room = {
				peer: users[0]
			}
		}
	}
	
	selectRoom.value = null;
	if(!route.query?.user){
		resize(1280,860,false);
	}
	setTimeout(()=>{
		selectRoom.value = _room;
	},100)
}

const visibleBotSelector = ref(false);
const selectedNewBots = ref({});

const bots = computed(() => store.getters["mcp/bots"]);
const deleteRoom = (bot) => {
	store.commit('mcp/deleteRoom', {
		mesh: selectedMesh.value?.name,
		bot
	})
	selectRoom.value = null;
}
const newBotRoom = () => {
	const _bots = Object.keys(selectedNewBots.value);
	let _room = null;
	if(!!_bots && _bots.length > 1){
		//todo
	} else {
		selectedNewBots.value = {};
		visibleBotSelector.value = false;
		const findroom = aiRooms.value.find(room => room.id == _bots[0]);
		if(findroom){
			_room = findroom;
		}else{
			const _bot = bots.value.find((b)=>b.id == _bots[0])
			_room = {
				..._bot,
				latest:{
					message:{
						text: `${_bot?.name} Assistant.`,
					},
					time: Date.now()
				}
			}
			store.commit('mcp/addRoom', {
				mesh: selectedMesh.value?.name,
				room: _room
			})
		}
	}
	
	selectRoom.value = null;
	if(!route.query?.user){
		resize(1280,860,false);
	}
	setTimeout(()=>{
		selectRoom.value = _room;
	},100)
}
const openChat = (item) => {
	selectRoom.value = null;
	if(!route.query?.user){
		resize(1280,860,false);
	}
	setTimeout(()=>{
		selectRoom.value = item;
		if(!!item.updated){
			read(item.updated);
		}
	},100)
}
const cnt = () => {
	let rtn = 0;
	uniRooms.value.forEach((room)=>{
		if(!!room.updated){
			rtn += room.updated;
		}
	})
	return rtn;
}
const back = () => {
	if(platform() == 'web' || !platform() || !!route.query?.user){
		router.go(-1)
	} else {
		emits('close');
	}
}
const manager = ref(false);
const history = ref(false);
const botHistory = ref(false);
const backList = () => {
	if(!!route.query?.user){
		router.go(-1)
	} else {
		selectRoom.value = false;
		history.value = false;
		botHistory.value = false;
		manager.value = false;
		resize(330,860,false);
	}
}
const backmanage = () => {
	botHistory.value = false;
	history.value = false;
	manager.value = false;
}
const backhistory = () => {
	history.value = false;
	manager.value = 'peer';
}
const botchat = ref();
const changeBot = (val)=> {
	botchat.value?.setBot(val);
	backmanage();
	botClear();
}
const botClear = ()=>{
	const _selectRoom = selectRoom.value;
	selectRoom.value = null;
	setTimeout(()=>{
		selectRoom.value = _selectRoom;
	},100);
}
const botHistoryRef = ref();
const loadBotHistory = () => {
	if(botHistoryRef.value){
		botHistoryRef.value.loaddata();
	}
}
watch(()=>selectedMesh,()=>{
	if(selectedMesh.value){
		load();
	}
},{
	deep:true,
	immediate:true
})

const menuRef = ref();
const menus = ref([
	{
			label: t('New Chat'),
			icon: 'iconfont icon-add-chat',
			command(){
				backList();
				visibleUserSelector.value = true;
			}
	},
	{
			label: t('New Bot'),
			icon: 'iconfont icon-add-bot',
			command(){
				backList();
				visibleBotSelector.value = true;
			}
	}
]);

const menuToggle = (event) => {
    menuRef.value.toggle(event);
};

onActivated(()=>{
	load();
})
onMounted(()=>{
	if(!!route.query?.user){
		selectedNewChatUsers.value[route.query.user] = true;
		newChat();
	}
	store.dispatch('mcp/initAgents', selectedMesh.value?.name);
})

</script>

<template>
	<div class="flex flex-row min-h-screen surface-ground">
		<div v-if="visibleUserSelector" class="w-full" :style="{ minHeight:'300px' }">
				
				<AppHeader :back="() => visibleUserSelector = false" :main="false">
						<template #center>
							<b>{{t('New Chat')}} <Badge class="ml-2 relative" style="top:-2px" v-if="Object.keys(selectedNewChatUsers).length>0" :value="Object.keys(selectedNewChatUsers).length"/></b>
						</template>
				
						<template #end> 
							<Button icon="pi pi-check" @click="newChat" :disabled="Object.keys(selectedNewChatUsers).length==0"/>
						</template>
				</AppHeader>
				<UserSelector
					:app="true" 
					size="small"
					class="w-full"
					:mesh="selectedMesh"
					multiple="tree" 
					:user="selectedMesh?.agent?.username" 
					v-model="selectedNewChatUsers" />
		</div>
		<div v-else-if="visibleBotSelector" class="w-full" :style="{ minHeight:'300px'  }">
				
				<AppHeader :back="() => visibleBotSelector = false" :main="false">
						<template #center>
							<b>{{t('Bots')}} <Badge class="ml-2 relative" style="top:-2px" v-if="Object.keys(selectedNewBots).length>0" :value="Object.keys(selectedNewBots).length"/></b>
						</template>
				
						<template #end> 
							<Button icon="pi pi-check" @click="newBotRoom" :disabled="Object.keys(selectedNewBots).length!=1"/>
						</template>
				</AppHeader>
				<BotSelector
					size="small"
					class="w-full"
					:mesh="selectedMesh?.name"
					multiple="tree" 
					v-model="selectedNewBots" />
		</div>
		<div v-else-if="!route.query?.user" class="relative h-full min-h-screen" :class="{'w-22rem':!!selectRoom,'w-full':!selectRoom,'mobile-hidden':!!selectRoom}">
				
			<AppHeader>
					<template #start>
						<Button @click="back" icon="pi pi-angle-left" severity="secondary" text />
					</template>
					<template #center>
						<b>{{t('Messages')}} <span v-if="cnt>0">({{cnt}})</span></b>
					</template>
					<template #end> 
						<Button type="button" icon="pi pi-plus" text @click="menuToggle" aria-haspopup="true" aria-controls="overlay_menu" />
						<Menu ref="menuRef" id="overlay_menu" :model="menus" :popup="true" />
					</template>
			</AppHeader>
			
			
			<ScrollPanel class="w-full absolute" style="bottom: 0;" :style="{'top': (isMobile && !selectRoom?'50px':'35px')}" >
			<DataView class="message-list" :value="uniRooms">
					<template #list="slotProps">
							<div @click="openChat(item)" class="flex flex-col message-item pointer" v-for="(item, index) in slotProps.items" :key="index">
								<div class="flex flex-col py-3 px-3 gap-4 w-full" :class="{ 'border-t border-surface-200 dark:border-surface-700': index !== 0 }">
										<div class="md:w-40 relative">
											<Badge v-if="item.updated" :value="item.updated" severity="danger" class="absolute" style="right: -10px;top:-10px"/>
											<img v-if="item.isAi" :src="gptSvg" width="42" height="42" />
											<Avatar shape="circle"  v-if="item.bot" icon="pi pi-prime" size="large"  />
											<Avatar shape="circle"  v-else-if="!!item.group" icon="pi pi-users" size="large"  />
											<Avatar shape="circle"  v-else-if="selectedMesh?.agent?.username == item.peer" icon="pi pi-tablet" size="large"  />
											<UserAvatar v-else :username="item?.peer" />
										</div>
										<div class="flex-item">
												<div class="flex" v-if="!!item?.peer">
													<div class="flex-item" >
														<b>{{item?.peer}}</b>
													</div>
													<Status :run="true" style="top: 7px;margin-right: 0;right: -10px;"/>
												</div>
												<div class="flex relative" v-else>
													<div class="flex-item" >
														<b>{{item.name}}</b>
													</div>
													<Button class="absolute pointer" style="right:-12px;top: -12px;opacity: 0.6;" v-if="item.id != 'default'" severity="secondary" text size="small" icon="pi pi-times" v-tooltip.right="t('Remove Room')" @click.stop="deleteRoom(item.id)" />
													
												</div>
												<div class="flex mt-1">
													<div class="flex-item" >
														<div class="w-10rem text-ellipsis" >
															<span v-if="item.latest?.message?.files?.length>0">[{{item.latest.message.files.length}} {{item.latest.message.files.length>1?t('Files'):t('File')}}]</span>
															<span v-if="item.latest?.message?.text">{{item.latest?.message?.text}}</span>
															&nbsp;
														</div>
													</div>
													<div class="w-5rem text-right text-tip opacity-60" >
														{{timeago(item.latest?.time)}}
													</div>
												</div>
										</div>
								</div>
							</div>
					</template>
				</DataView>
			</ScrollPanel>
		</div>
		<div v-if="selectRoom" class="flex-item min-h-screen" style="flex: 3;">
			<div class="shadow mobile-fixed min-h-screen relative" style="z-index:2">
				<BotChat 
					ref="botchat" 
					v-if="selectRoom?.bot" 
					v-model:room="selectRoom" 
					@back="backList" 
					@manager="() => manager = 'bot'" 
					@history="() => botHistory = true"
					@notify="loadBotHistory"
					/>
				<Chat v-else v-model:room="selectRoom" @back="backList" @manager="() => manager = 'peer'"/>
			</div>
		</div>
		<div v-if="manager == 'peer' && history" class="flex-item min-h-screen " style="flex: 2;">
			<div class="shadow mobile-fixed min-h-screen surface-html" >
				<History v-model:room="selectRoom" @back="backhistory" />
			</div>
		</div>
		<div v-else-if="manager == 'peer' && selectRoom" class="flex-item min-h-screen " style="flex: 2;">
			<div class="shadow mobile-fixed min-h-screen surface-html" >
				<Setting v-model:room="selectRoom" @back="backmanage" @history="() => history = true"/>
			</div>
		</div>
		<div v-else-if="botHistory" class="flex-item min-h-screen " style="flex: 2;">
			<div class="shadow mobile-fixed min-h-screen surface-html" >
				<BotHistory v-model:room="selectRoom" ref="botHistoryRef" @clear="botClear" @back="backmanage" />
			</div>
		</div>
		<div v-else-if="manager == 'bot' && selectRoom" class="flex-item min-h-screen " style="flex: 2;">
			<div class="shadow mobile-fixed min-h-screen surface-html" >
				<BotSetting v-model:room="selectRoom" @saved="changeBot" @back="backmanage" />
			</div>
		</div>
	</div>
</template>

<style lang="scss">
	
</style>