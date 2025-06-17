import { send } from "@/utils/notification";
import BotService from '@/service/BotService';
import { 
	getItem, 
	setItem,
	deleteItem, 
	unshiftItem, 
	pushItem, 
	STORE_SETTING_LLM, 
	STORE_BOT_CONTENT, 
	STORE_BOT_ROOMS ,
} from "@/utils/localStore";
const botService = new BotService();
const MAX_CONTENT = 10;
export default {
  namespaced: true,
  state: {
		running:false,
		rooms:[],
		clients:[],
		logs:{},
		listTools:[],
		messages:[],
		notice: true,
  },
  getters: {
    rooms: (state) => {
      return state.rooms;
    },
    notice: (state) => {
      return state.notice;
    },
    messages: (state) => {
      return state.messages;
    },
    clients: (state) => {
      return state.clients;
    },
    running: (state) => {
      return state.running;
    },
    logs: (state) => {
      return state.logs;
    },
    listTools: (state) => {
      return state.listTools;
    },
  },
	actions: {
		initRooms({ commit, getters }, mesh) {
			getItem(STORE_BOT_ROOMS(mesh), (rooms)=>{
				commit('setRooms', { rooms:rooms || [] });
			});
		},
		worker({ commit, getters }, data) {
			let delta = "";
			const mesh = data?.mesh;
			const roomId = data?.roomId;
			getItem(STORE_BOT_CONTENT(mesh, roomId), (historyContext)=>{
				botService.callRunnerBySDK({
					...data,
					roomId,
					historyContext,
					callback(res, ending){
						const choices = res?.choices;
						const choice = !!choices && choices[0];
						if(choice?.message){
							const message = choice?.message?.reasoning_content||choice?.message?.content||'';
							commit('pushMessage', {message, ending:true});
						} else {
							const _delta = choice?.delta?.reasoning_content||choice?.delta?.content||'';
							if(!!_delta || ending){
								const first = !delta;
								delta += _delta;
								commit('pushMessage', {delta, ending, first});
								if(!!ending) {
									const latest = delta.split('\n').slice(-1)[0];
									
									//upd room lasted msg
									const rooms = getters['rooms']||[];
									const roomIdx = rooms.findIndex((r)=> r.id == roomId);
									if(roomIdx>=0){
										rooms[roomIdx].latest.text = latest;
										rooms[roomIdx].time = Date.now();
									}
									setItem(STORE_BOT_ROOMS(mesh), rooms, (res)=>{
										commit('setRooms', { rooms:rooms || [] });
									});
									//end
									
									pushItem(STORE_BOT_CONTENT(mesh, roomId), {
										'content': delta, 
										'refusal': null, 'annotations': null, 'audio': null, 'function_call': null, 
										'role': 'assistant', 
									}, ()=>{},10);
									
									delta = '';
									const notice = getters['notice'];
									if(notice){
										send('AI机器人', latest);
									}
								}
							}
						}
					}
				})
			
			});
		},
		stopAll({ commit, getters }) {
			const _clients = getters['clients'];
			_clients.forEach((client)=>{
				if(!!client?.client){
					client.client.close()
				}
			})
			commit('setClients', []);
			commit('setLogs', {});
			commit('setRunning', false);
		},
	},
  mutations: {
		
		addRoom(state, room) {
		  state.rooms.unshift(room);
			unshiftItem(STORE_BOT_ROOMS(room?.mesh), room, ()=>{});
		},
		deleteRoom(state, room) {
		  state.rooms.splice(room?.index,1);
			deleteItem(STORE_BOT_ROOMS(room?.mesh), room?.index, ()=>{});
		},
    setRooms(state, d) {
      state.rooms = d?.rooms;
			if(d?.store){
				setItem(STORE_BOT_ROOMS(d?.mesh), d?.rooms, ()=>{});
			}
    },
    setNotice(state, notice) {
      state.notice = notice;
    },
    setMessages(state, messages) {
      state.messages = messages;
    },
    pushMessage(state, message) {
      state.messages.push(message);
    },
    setListTools(state, listTools) {
      state.listTools = listTools;
    },
    pushListTools(state, listTools) {
      state.listTools.push(...listTools);
    },
    pushLog(state, key ,log) {
			if(!state.logs[key]){
				state.logs[key] = []
			}
      state.logs[key].push(log);
    },
		clearLog(state, key) {
			state.logs[key] = [];
		},
    pushClient(state, client) {
      state.clients.push(client);
    },
    disconnectClient(state, name) {
      const idx = state.clients.findIndex((client) => client?.name == name);
			if(idx>=0){
				if(!!state.clients[idx]?.client){
					state.clients[idx].client.close();
				};
				state.clients.splice(idx,1);
			}
    },
    setClients(state, clients) {
      state.clients = clients;
    },
    setLogs(state, logs) {
      state.logs = logs;
    },
    setRunning(state, running) {
      state.running = running;
    },
  },
};
