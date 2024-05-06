export default {
  namespaced: true,
  state: {
		confirm:null,
		toast:null,
  },
  getters: {
    confirm: (state) => {
      return state.confirm;
    },
    toast: (state) => {
      return state.toast;
    },
  },
  mutations: {
    setConfirm(state, confirm) {
      state.confirm = confirm;
    },
    setToast(state, toast) {
      state.toast = toast;
    },
  },
};
