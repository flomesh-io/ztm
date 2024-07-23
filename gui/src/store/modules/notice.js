export default {
  namespaced: true,
  state: {
		confirm:null,
		toast:null,
		app:null,
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
  },
};
