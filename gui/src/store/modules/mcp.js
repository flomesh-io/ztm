import { send } from "@/utils/notification";
import BotService from '@/service/BotService';
const botService = new BotService();

export default {
  namespaced: true,
  state: {
		running:false,
		clients:[],
		logs:{},
		listTools:[],
		messages:[],
		latest:'',
		notice: true,
  },
  getters: {
    latest: (state) => {
      return state.latest;
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
		worker({ commit, getters }, data) {
			let delta = "";
			botService.callRunnerBySDK({
				...data,
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
								commit('setLatest', latest);
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
    setLatest(state, latest) {
      state.latest = latest;
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
