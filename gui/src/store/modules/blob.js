export default {
  namespaced: true,
  state: {
		urls:{},
  },
  getters: {
    urls: (state) => {
      return state.urls;
    },
  },
  mutations: {
    setUrl(state, n) {
      state.urls[n[0]] = n[1];
    },
    setUrls(state, urls) {
      state.urls = urls;
    },
  },
};
