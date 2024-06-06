export default {
  namespaced: true,
  state: {
    target: {
			icon: '',
			name: '',
			url: '',
			proxy: '',
		},
  },
  getters: {
    target: (state) => {
      return state.target;
    },
  },
  mutations: {
    setTarget(state, target) {
      state.target = target;
    },
  },
};
