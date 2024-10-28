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
		rooms:[],
  },
	actions: {
		async rooms({ commit }) {
			const res = await chatService.getRooms();
			commit('setRooms',res || []);
			const news = (res || []).filter((room)=>!!room.updated) || [];
			let _unread = 0;
			news.forEach((room)=>{
				if(room.updated>0){
					_unread += room.updated;
					send(room?.name||room?.peer, room?.latest?.message?.type == 'text'?`${room?.latest?.sender}:${room?.latest?.message?.content}`:`${room?.latest?.sender}:[File]`)
				}
			});
			commit('setUnread',_unread);
		},
	},
  getters: {
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
