import store from '@/store';
const add = (option) => {
	const toast = store.getters["notice/toast"];
	toast.add(option)
}

export default {
	add
};