import { invoke } from '@tauri-apps/api/core';

export const setItem = (key, value, callback, max) => {
	let _value = value;
	if(!!max && _value.length>max){
		_value = _value.slice(_value.length-max);
	}
	if(!!window.__TAURI_INTERNALS__ ){
		invoke('set_store_list',{ key, value: _value }).then((res)=> callback());
	} else {
		localStorage.setItem(key, JSON.stringify(_value))
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

export const pushItem = (key, value, callback, max) => {
	getItem(key,(res)=>{
		let ary = res || [];
		if(!!max && ary.length>max){
			ary.splice(0,ary.length-max);
		}
		ary.push(value);
		setItem(key,ary,callback);
	});
}
export const unshiftItem = (key, value, callback, max) => {
	getItem(key,(res)=>{
		let ary = res || [];
		if(!!max && ary.length>max){
			ary.splice(max-1,ary.length-max);
		}
		ary.unshift(value);
		setItem(key,ary,callback);
	});
}

export const deleteItem = (key, index, callback) => {
	getItem(key,(res)=>{
		let ary = res || [];
		ary.splice(index,1);
		setItem(key,ary,callback);
	});
}
export const STORE_SETTING_LLM = (mesh, id) => {
	return `llm-${mesh}`+ (!!id?`-${id}`:'');
}
export const STORE_SETTING_MCP = (mesh, id) => {
	return `mcp-${mesh}`+ (!!id?`-${id}`:'');
}
export const STORE_BOT_CONTENT = (mesh, id) => {
	return `bot-content-${mesh}`+ (!!id?`-${id}`:'');
}
export const STORE_BOT_REPLAY = (mesh, id) => {
	return `bot-replay-${mesh}`+ (!!id?`-${id}`:'');
}
export const STORE_BOT_HISTORY = (mesh, id) => {
	return `bot-history-${mesh}`+ (!!id?`-${id}`:'');
}
export const STORE_BOT_ROOMS = (mesh) => {
	return `bot-rooms-${mesh}`;
}
export const STORE_BOT_AGENTS = (mesh) => {
	return `bot-agents-${mesh}`;
}

