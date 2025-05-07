import { invoke } from '@tauri-apps/api/core';

export const setItem = (key, value, callback) => {
	if(!!window.__TAURI_INTERNALS__ ){
		invoke('set_store_list',{ key, value}).then((res)=> callback());
	} else {
		localStorage.setItem(key, JSON.stringify(value))
		callback()
	}
}

export const getItem = (key, callback) => {
	if(!!window.__TAURI_INTERNALS__ ){
		invoke('get_store_list',{ key }).then((res)=>callback(res));
	} else {
		callback(JSON.parse(localStorage.getItem(key)))
	}
}