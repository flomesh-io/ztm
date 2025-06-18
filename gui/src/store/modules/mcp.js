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
	STORE_BOT_ROOMS,
	STORE_BOT_AGENTS,
} from "@/utils/localStore";
const botService = new BotService();
const MAX_CONTENT = 10;
const DEFAULT_BOT = {
	id: 'default',
	name: 'Agent Bot'
}
export default {
  namespaced: true,
  state: {
		running:false,
		rooms:[],
		bots:[],
		clients:[],
		logs:{},
		listTools:[],
		messages:[],
		notice: true,
  },
  getters: {
    bots: (state) => {
      return state.bots;
    },
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
		initAgents({ commit, getters }, mesh) {
			const currentDate = Date.now();
			getItem(STORE_BOT_ROOMS(mesh), (res)=>{
				const rooms = res||[];
				if(rooms.length == 0){
					commit('setRooms',{
						store: true,
						mesh,
						rooms: [{
							...DEFAULT_BOT,
							latest:{
								message:{
									text: 'My MCP Assistant.',
								},
								time: currentDate
							}
						}]
					});
				} else {
					commit('setRooms', { rooms });
				}
			});
			
			getItem(STORE_BOT_AGENTS(mesh), (res)=>{
				const bots = res||[];
				if(bots.length == 0){
					commit('setBots',{
						store: true,
						mesh,
						bots: [DEFAULT_BOT]
					});
				} else {
					commit('setBots', { bots });
				}
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
		
		addBot(state, d) {
		  state.bots.unshift(d?.bot);
			unshiftItem(STORE_BOT_AGENTS(d?.mesh), d?.bot, ()=>{});
		},
		deleteBot(state, d) {
			const remIdx = state.bots.findIndex((b)=>b.id == d?.bot);
			if(remIdx>=0){
				state.bots.splice(remIdx,1);
				deleteItem(STORE_BOT_AGENTS(d?.mesh), remIdx, ()=>{});
			}
			
			const remRoomIdx = state.rooms.findIndex((b)=>b.id == d?.bot);
			if(remRoomIdx>=0){
				state.rooms.splice(remRoomIdx,1);
				deleteItem(STORE_BOT_ROOMS(d?.mesh), remRoomIdx, ()=>{});
			}
		},
		setBots(state, d) {
		  state.bots = d?.bots;
			if(d?.store){
				setItem(STORE_BOT_AGENTS(d?.mesh), d?.bots, ()=>{});
			}
		},
		addRoom(state, d) {
		  state.rooms.unshift(d?.room);
			unshiftItem(STORE_BOT_ROOMS(d?.mesh), d?.room, ()=>{});
		},
		deleteRoom(state, d) {
			const remRoomIdx = state.rooms.findIndex((b)=>b.id == d?.bot);
			if(remRoomIdx>=0){
				state.rooms.splice(remRoomIdx,1);
				deleteItem(STORE_BOT_ROOMS(d?.mesh), remRoomIdx, ()=>{});
			}
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
