import { send } from "@/utils/notification";
import ChatService from '@/service/ChatService';
const chatService = new ChatService();

export default {
  namespaced: true,
  state: {
		confirm:null,
		toast:null,
		app:null,
		unread:0,
		errorLength:0,
		rooms:[],
		pushed:{},
  },
	actions: {
		async rooms({ commit, getters }) {
			try{
				const res = await chatService.getRooms();
				commit('setRooms',(res || []).sort((a, b) => b.time - a.time));
				const news = (res || []).filter((room)=>!!room.updated) || [];
				let _unread = 0;
				news.forEach((room)=>{
					if(room.updated>0){
						_unread += room.updated;
						let _msg = ""
						const _pushed = getters['pushed'];
						if(!!room?.peer){
							const _key = `${room?.peer}-${room?.latest?.sender}-${room?.time}`;
							if(!_pushed[_key]){
								commit('setPushedByKey',_key);
								send(room?.peer, room?.latest?.message?.text?`${room?.latest?.message?.text}`:`[${room?.latest?.message?.files?.length>1?'Files':'File'}]`)
							}
						}else {
							const _key = `${room?.group}-${room?.latest?.sender}-${room?.time}`;
							if(!_pushed[_key]){
								commit('setPushedByKey',_key);
								send(room?.name, room?.latest?.message?.text?`${room?.latest?.sender}:${room?.latest?.message?.text}`:`${room?.latest?.sender}:[${room?.latest?.message?.files?.length>1?'Files':'File'}]`)
							}
						}
					}
				});
				commit('setUnread',_unread);
			}catch(e){
				commit('setErrorLength',getters['errorLength'] + 1);
			}
		},
	},
  getters: {
    errorLength: (state) => {
      return state.errorLength;
    },
    pushed: (state) => {
      return state.pushed;
    },
    confirm: (state) => {
      return state.confirm;
    },
    toast: (state) => {
      return state.toast;
    },
    app: (state) => {
      return state.app;
    },
    rooms: (state) => {
      return state.rooms;
    },
    unread: (state) => {
      return state.unread;
    },
  },
  mutations: {
    setErrorLength(state, errorLength) {
      state.errorLength = errorLength;
    },
    setPushedByKey(state, pushed) {
      state.pushed[pushed] = true;
    },
    setPushed(state, pushed) {
      state.pushed = pushed;
    },
    setConfirm(state, confirm) {
      state.confirm = confirm;
    },
    setToast(state, toast) {
      state.toast = toast;
    },
    setApp(state, app) {
      state.app = app;
    },
    setRooms(state, rooms) {
      state.rooms = rooms;
    },
    setUnread(state, unread) {
      state.unread = unread;
    },
  },
};
