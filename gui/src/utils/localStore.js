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

export const pushItem = (key, value, max, callback) => {
	getItem(key,(res)=>{
		let ary = res || [];
		if(!!max && ary.length>max){
			ary.splice(0,ary.length-max);
		}
		ary.push(value);
		setItem(key,ary,callback);
	});
}