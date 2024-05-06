import store from '@/store';

const remove = (accept, cancel) => {
	const confirm = store.getters["notice/confirm"];
	confirm.require({
		message: `确定要删除吗 ?`,
		header: '提示',
		icon: 'pi pi-exclamation-triangle',
		rejectProps: {
				label: '取消',
				severity: 'secondary',
				outlined: true
		},
		acceptProps: {
				severity: 'danger',
				label: '删除'
		},
		accept: () => {
			accept()
		},
		reject: () => {
			!!cancel && cancel()
		}
	})
}
const custom = (msg, accept, cancel) => {
	const confirm = store.getters["notice/confirm"];
	confirm.require({
		message: msg,
		header: '提示',
		icon: 'pi pi-exclamation-triangle',
		rejectProps: {
				label: '取消',
				severity: 'secondary',
				outlined: true
		},
		acceptProps: {
				severity: 'danger',
				label: '确定'
		},
		accept: () => {
			accept()
		},
		reject: () => {
			!!cancel && cancel()
		}
	})
}
const require = (options) => {
	const store = useStore();
	const confirm = store.getters["notice/confirm"];
	confirm.require(options);
}
export default {
	remove,
	custom,
	require
};