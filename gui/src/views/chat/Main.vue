<script setup>
import { ref, onMounted,onActivated,watch, computed } from "vue";
import { useStore } from 'vuex';
import Chat from "./Chat.vue"
import Setting from './Setting.vue'
import History from './History.vue'
import { dayjs, extend } from '@/utils/dayjs';
import { useRouter } from 'vue-router'
import ChatService from '@/service/ChatService';
import EndpointDetail from '../mesh/EndpointDetail.vue'
import ZtmService from '@/service/ZtmService';
import gptSvg from "@/assets/img/gpt.png";
import { resize, position } from "@/utils/window";
import _ from "lodash";

extend('en')
const props = defineProps(['app']);
const emits = defineEmits(['close'])
const store = useStore();
const router = useRouter();
const chatService = new ChatService();
const ztmService = new ZtmService();
const selectedMesh = computed(() => {
	return store.getters["account/selectedMesh"]
});
const aiRooms = [
	{
		id: 'gpt',
		name: 'Chat GPT',
		isAi: true,
		latest:{
			type: "text",
			content:'Welcome ztm.',
			time: Date.now()
		}
	}
];
const rooms = computed(() => store.getters["notice/rooms"]);
const uniRooms = computed(() => {
	let rtn = _.cloneDeep(rooms.value);
	let index = rtn.findIndex(item => item.peer == selectedMesh.value?.agent?.username);
	if (index != -1) {
	  let node = rtn.splice(index, 1)[0];
	  rtn.unshift(node);
	} else {
		rtn.unshift({
			peer: selectedMesh.value?.agent?.username,
			latest:{
				message:{
					type: "text",
					content:'My Room.',
				},
				time: Date.now()
			}
		})
	}
	return rtn;
});
const unread = computed(() => {
	return store.getters["notice/unread"];
});
const windowWidth = ref(window.innerWidth);
const isMobile = computed(() => windowWidth.value<=768);
const read = (updated) => {
	const _unread = unread.value - updated
	store.commit('notice/setUnread',_unread >0?_unread:0);
}

const endpointMap = ref({});
const endpoints = ref([]);
const getEndpoints = () => {
	endpointMap.value = {};
	ztmService.getEndpoints(selectedMesh.value?.name)
		.then(res => {
			res.forEach(ep=>{
				endpointMap.value[ep.id] = ep;
			});
			endpoints.value = res || [];
			endpoints.value.forEach((ep,ei)=>{
				ep.key = ep.id;
				ep.index = ei;
				ep.type = "ep";
				ep.label = `${ep?.name} (${ep?.username})`;
				ep.icon = "pi pi-user";
				ep.loading = false;
			});
		})
		.catch(err => console.log('Request Failed', err)); 
}

const loadrooms = () => {
	store.dispatch('notice/rooms');
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
const firstOpen = ref(false);
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
	resize(1280,860,false);
	if(!firstOpen.value){
		position(30,30)
		firstOpen.value = true;
	}
	setTimeout(()=>{
		selectRoom.value = _room;
	},100)
}
const openChat = (item) => {
	selectRoom.value = null;
	resize(1280,860,false);
	if(!firstOpen.value){
		position(30,30)
		firstOpen.value = true;
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
const users = ref([]);
const usersTree = computed(()=>{
	const _users = [];
	users.value.forEach((user,index)=>{
		_users.push({
			key:user,
			label:user,
			data:user,
		})
	});
	return _users;
})
const loadusers = () => {
	chatService.getUsers()
		.then(res => {
			users.value = res.filter((item) => item != selectedMesh.value?.agent?.username);
		})
}
const back = () => {
	emits('close')
}
const manager = ref(false)
const history = ref(false)
const backList = () => {
	selectRoom.value = false;
	history.value = false;
	manager.value = false;
	resize(330,860,false);
}
const backmanage = () => {
	history.value = false;
	manager.value = false;
	// resize(330,860,false);
}
const backhistory = () => {
	history.value = false;
	manager.value = true;
}
watch(()=>selectedMesh,()=>{
	if(selectedMesh.value){
		getEndpoints();
		loadrooms();
		loadusers();
	}
},{
	deep:true,
	immediate:true
})
onActivated(()=>{
	getEndpoints();
	loadrooms();
	loadusers();
})

</script>

<template>
	<div class="flex flex-row min-h-screen">
		<div class="relative h-full min-h-screen" :class="{'w-22rem':!!selectRoom,'w-full':!selectRoom,'mobile-hidden':!!selectRoom}">
				
			<AppHeader>
					<template #start>
						<Button @click="back" icon="pi pi-angle-left" severity="secondary" text />
					</template>
					<template #center>
						<b>Messages <span v-if="cnt>0">({{cnt}})</span></b>
					</template>
					<template #end> 
						<Button text v-tooltip="'New Chat'" icon="pi pi-plus"  @click="()=> {loadusers();visibleUserSelector = true}" />
					</template>
			</AppHeader>
			<Dialog class="noheader" v-model:visible="visibleUserSelector" modal header="New chat" :style="{ width: '25rem' }">
					
					<AppHeader :back="() => visibleUserSelector = false" :main="false">
							<template #center>
								<b>New Chat <Badge class="ml-2 relative" style="top:-2px" v-if="Object.keys(selectedNewChatUsers).length>0" :value="Object.keys(selectedNewChatUsers).length"/></b>
							</template>
					
							<template #end> 
								<Button icon="pi pi-check" @click="newChat" :disabled="Object.keys(selectedNewChatUsers).length==0"/>
							</template>
					</AppHeader>
					<Tree :filter="usersTree.length>8" filterMode="lenient" v-model:selectionKeys="selectedNewChatUsers" :value="usersTree" selectionMode="checkbox" class="w-full md:w-[30rem]">
						<template #nodeicon="slotProps">
								<Avatar icon="pi pi-user" size="small" style="background-color: #ece9fc; color: #2a1261" />
						</template>
						<template #default="slotProps">
								<b class="px-2">{{ slotProps.node?.label }}</b>
						</template>
					</Tree>
			</Dialog>
			
			<ScrollPanel class="w-full absolute" style="bottom: 0;" :style="{'top': (isMobile && !selectRoom?'50px':'35px')}" >
			<DataView class="message-list" :value="uniRooms">
					<template #list="slotProps">
							<div @click="openChat(item)" class="flex flex-col message-item pointer" v-for="(item, index) in slotProps.items" :key="index">
								<div class="flex flex-col py-3 px-3 gap-4 w-full" :class="{ 'border-t border-surface-200 dark:border-surface-700': index !== 0 }">
										<div class="md:w-40 relative">
											<Badge v-if="item.updated" :value="item.updated" severity="danger" class="absolute" style="right: -10px;top:-10px"/>
											<img v-if="item.isAi" :src="gptSvg" width="42" height="42" />
											<Avatar v-else-if="!!item.group" icon="pi pi-users" size="large"  />
											<Avatar v-else-if="selectedMesh?.agent?.username == item.peer" icon="pi pi-tablet" size="large"  />
											<Avatar v-else icon="pi pi-user" size="large"  />
											
										</div>
										<div class="flex-item">
												<div class="flex" v-if="!!item?.peer">
													<div class="flex-item" >
														<b>{{item?.peer}}</b>
													</div>
													<Status :run="true" style="top: 7px;margin-right: 0;right: -10px;"/>
												</div>
												<div class="flex" v-else>
													<div class="flex-item" >
														<b>{{item.name}}</b>
													</div>
												</div>
												<div class="flex mt-1">
													<div class="flex-item" >
														<div class="w-10rem text-ellipsis" >
															<span v-if="item.latest?.message?.files?.length>0">[{{item.latest.message.files.length}} {{item.latest.message.files.length>1?'Files':'File'}}]</span>
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
	<!-- 	<div class="flex-item" v-if="!!selectPeer">
			<div class="shadow mobile-fixed">
				<EndpointDetail @back="() => selectPeer=false" :ep="selectPeer"/>
			</div>
		</div> -->
		<div v-if="selectRoom" class="flex-item min-h-screen" style="flex: 3;">
			<div class="shadow mobile-fixed min-h-screen relative" style="z-index:2">
				<Chat :endpointMap="endpointMap" v-model:room="selectRoom" @back="backList" @manager="() => manager = true"/>
			</div>
		</div>
		<div v-if="manager && history" class="flex-item min-h-screen " style="flex: 2;">
			<div class="shadow mobile-fixed min-h-screen surface-html" >
				<History :users="users" v-model:room="selectRoom" @back="backhistory" />
			</div>
		</div>
		<div v-else-if="manager && selectRoom" class="flex-item min-h-screen " style="flex: 2;">
			<div class="shadow mobile-fixed min-h-screen surface-html" >
				<Setting :users="users" v-model:room="selectRoom" @back="backmanage" @history="() => history = true"/>
			</div>
		</div>
		
	</div>
</template>

<style lang="scss">
	
</style>