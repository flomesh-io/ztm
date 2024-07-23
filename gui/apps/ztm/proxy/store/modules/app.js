export default {
  namespaced: true,
  state: {
		info:null,
  },
  getters: {
    info: (state) => {
      return state.info;
    },
  },
  mutations: {
    setInfo(state, info) {
      state.info = info;
    },
  },
};
