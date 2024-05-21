import PipyProxyService from '@/service/PipyProxyService';
const pipyProxyService = new PipyProxyService();
export default {
  namespaced: true,
  state: {
    user: undefined,
    routesConfig: null,
		pipyRunning: false,
		guest: false,
		redirect: null,
		appkey: null,
		version: '',
		client: null,
		pid: null,
		child: null,
		collapsed: true,
		meshes:[],
		platform: null,
		selectedMesh:null,
		logs:[],
  },
	actions: {
		async meshes({ commit }) {
			const res = await pipyProxyService.getMeshes;
			commit('setMeshes',res || []);
		},
	},
  getters: {
    platform: (state) => {
      return state.platform;
    },
    pid: (state) => {
      return localStorage.getItem('PID') || state.pid;
    },
    logs: (state) => {
      return state.logs;
    },
    pipyRunning: (state) => {
      return state.pipyRunning;
    },
    meshes: (state) => {
      return state.meshes;
    },
    selectedMesh: (state) => {
      return state.selectedMesh;
    },
    child: (state) => {
      return state.child;
    },
    client: (state) => {
      return state.client;
    },
    appkey: (state) => {
      return state.appkey;
    },
    version: (state) => {
      return state.version;
    },
    redirect: (state) => {
      return state.redirect;
    },
    guest: (state) => {
      return state.guest;
    },
    collapsed: (state) => {
      return state.collapsed;
    },
    user: (state) => {
      if (!state.user) {
        try {
          const user = localStorage.getItem('User');
          state.user = JSON.parse(user);
        } catch (e) {
          console.error(e);
        }
      }
      return state.user;
    },
    routesConfig: (state) => {
      if (!state.routesConfig) {
        try {
          const routesConfig = localStorage.getItem('Route');
          state.routesConfig = JSON.parse(routesConfig);
          state.routesConfig = state.routesConfig ? state.routesConfig : [];
        } catch (e) {
          console.error(e.message);
        }
      }
      return state.routesConfig;
    },
  },
  mutations: {
    setPipyRunning(state, pipyRunning) {
      state.pipyRunning = pipyRunning;
    },
    setLogs(state, logs) {
      state.logs = logs;
    },
    setPlatform(state, platform) {
      state.platform = platform;
    },
    pushLog(state, log) {
			if(!state.logs){
				state.logs = [];
			}
			state.logs.push(log)
    },
    setPid(state, pid) {
      state.pid = pid;
			localStorage.setItem('PID',pid);
    },
    setClient(state, client) {
      state.client = client;
    },
    setChild(state, child) {
      state.child = child;
    },
    setMeshes(state, meshes) {
      state.meshes = meshes;
    },
    setSelectedMesh(state, selectedMesh) {
      state.selectedMesh = selectedMesh;
    },
    setVersion(state, version) {
      state.version = version;
    },
    setRedirect(state, redirect) {
      state.redirect = redirect;
    },
    setAppkey(state, appkey) {
      state.appkey = appkey;
    },
    setGuest(state, guest) {
      state.guest = guest;
    },
    setCollapsed(state, collapsed) {
      state.collapsed = collapsed;
    },
    setUser(state, user) {
      state.user = user;
      localStorage.setItem('User', JSON.stringify(user));
    },
    setRoutesConfig(state, routesConfig) {
      state.routesConfig = routesConfig;
      localStorage.setItem('Route',
        JSON.stringify(routesConfig),
      );
    },
  },
};
