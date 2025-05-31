import ZtmService from '@/service/ZtmService';
const ztmService = new ZtmService();
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
		shortcuts: null,
		client: null,
		rootPermit: null,
		hubpid: null,
		pid: null,
		hubchild: null,
		child: null,
		collapsed: true,
		meshes:[],
		platform: null,
		selectedMesh:null,
		mobileLeftbar: false,
		avatars: {},
		mode: import.meta.env.VITE_APP_MODE,
		logs:[],
  },
	actions: {
		async meshes({ commit }) {
			const res = await ztmService.getMeshes();
			console.log("dispatch('account/meshes')")
			console.log(res)
			commit('setMeshes',res || []);
		},
	},
  getters: {
    mobileLeftbar: (state) => {
      return state.mobileLeftbar;
    },
    avatars: (state) => {
      return state.avatars;
    },
    mode: (state) => {
      return state.mode;
    },
    platform: (state) => {
      return state.platform;
    },
    pid: (state) => {
      return localStorage.getItem('PID') || state.pid;
    },
    hubpid: (state) => {
      return localStorage.getItem('HUB_PID') || state.hubpid;
    },
    rootPermit: (state) => {
      return state.rootPermit;
    },
    child: (state) => {
      return state.child;
    },
    hubchild: (state) => {
      return state.hubchild;
    },
    shortcuts: (state) => {
			let _shortcuts = []
			try{
				_shortcuts = JSON.parse(localStorage.getItem("SHORTCUT")||"[]");
			}catch(e){
				_shortcuts = []
			}
      return state.shortcuts || _shortcuts;
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
    setAvatars(state, avatars) {
      state.avatars = avatars;
    },
    setAvatar(state, n) {
      state.avatars[n[0]] = n[1];
    },
    setMobileLeftbar(state, mobileLeftbar) {
      state.mobileLeftbar = mobileLeftbar;
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
    setHubpid(state, hubpid) {
      state.hubpid = hubpid;
			localStorage.setItem('HUB_PID',hubpid);
    },
    setRootPermit(state, rootPermit) {
      state.rootPermit = rootPermit;
    },
    setPid(state, pid) {
      state.pid = pid;
			localStorage.setItem('PID',pid);
    },
    setHubchild(state, hubchild) {
      state.hubchild = hubchild;
    },
    setChild(state, child) {
      state.child = child;
    },
    setShortcuts(state, shortcuts) {
      state.shortcuts = shortcuts;
			localStorage.setItem("SHORTCUT",JSON.stringify(shortcuts));
    },
    setClient(state, client) {
      state.client = client;
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
