import store from '@/store';

const remove = (accept, cancel) => {
	const confirm = store.getters["notice/confirm"];
	confirm.require({
		message: `Are you sure you want to delete it?`,
		header: 'Tips',
		icon: 'pi pi-exclamation-triangle',
		rejectProps: {
				label: 'Cancel',
				severity: 'secondary',
				outlined: true
		},
		acceptProps: {
				severity: 'danger',
				label: 'Delete'
		},
		accept: () => {
			accept()
		},
		reject: () => {
			!!cancel && cancel()
		}
	})
}
const custom = ({
	header,message,icon, accept, cancel
}) => {
	const confirm = store.getters["notice/confirm"];
	confirm.require({
		message,
		header: header || 'Tips',
		icon: icon||'pi pi-exclamation-triangle',
		rejectProps: {
				label: 'Cancel',
				severity: 'secondary',
				outlined: true
		},
		acceptProps: {
				severity: 'danger',
				label: 'Ok'
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