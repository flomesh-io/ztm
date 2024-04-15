export default {
  namespaced: true,
  state: {
    user: undefined,
    routesConfig: null,
		pipyRunning: false,
		guest: false,
		redirect: null,
		appkey: null,
		pipyVersion: '',
		client: null,
		pid: null,
		child: null,
		collapsed: true,
		meshes:[],
  },
  getters: {
    pid: (state) => {
      return localStorage.getItem('PID') || state.pid;
    },
    pipyRunning: (state) => {
      return state.pipyRunning;
    },
    meshes: (state) => {
      return state.meshes;
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
    pipyVersion: (state) => {
      return state.pipyVersion;
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
    setPipyVersion(state, pipyVersion) {
      state.pipyVersion = pipyVersion;
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
