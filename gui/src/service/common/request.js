import { fetch } from '@tauri-apps/plugin-http';
import axios from "axios";
import Cookie from './cookie'
import toast from "@/utils/toast";

const xsrfHeaderName = "Authorization";
const DEFAULT_VITE_APP_API_PORT = import.meta.env.VITE_APP_API_PORT;

const AUTH_TYPE = {
  BEARER: "Bearer",
  BASIC: "basic",
  AUTH1: "auth1",
  AUTH2: "auth2",
};

const METHOD = {
  GET: "GET",
  POST: "POST",
  DELETE: "DELETE",
  PUT: "PUT",
};

function getUrl(url){
	let path = "";
	if(location.pathname){
		let params = location.pathname.split('/');
		if(params.length >= 8){
			params.splice(params.length-1,1)
			path = params.join("/")
		}
	}
	const devPath = localStorage.getItem("DEV_BASE")
	if(!!devPath){
		return `${devPath}${url}`
	}else if(!window.__TAURI_INTERNALS__ || url.indexOf('://')>=0){
		return `${path}${url}`
	} else {
		return `http://127.0.0.1:${getPort()}${path}${url}`
	}
}
function getLocalUrl(url){
	let path = "";
	if(location.pathname){
		let params = location.pathname.split('/');
		if(params.length >= 8){
			params.splice(params.length-1,1)
			path = params.join("/")
		}
	}
	if(location.port<2000){
		return `${url}`
	}else if(!window.__TAURI_INTERNALS__ || url.indexOf('://')>=0){
		return `${path}${url}`
	} else {
		return `http://127.0.0.1:${getPort()}${path}${url}`
	}
}
const getPort = () => {
	const VITE_APP_API_PORT = localStorage.getItem("VITE_APP_API_PORT") || (!!location?.port && location.port>=2000?location.port:null);
	return VITE_APP_API_PORT || DEFAULT_VITE_APP_API_PORT || 7777;
}
const setPort = (port) => {
	localStorage.setItem("VITE_APP_API_PORT",port);
}
const toastMessage = (e) => {
	if(!!e.status && !!e.message){
		toast.add({ severity: 'error', summary: 'Tips', detail: `[${e.status}]${e.message}`, life: 3000 });
	} else if(!!e.message){
		toast.add({ severity: 'error', summary: 'Tips', detail: `${e.message}`, life: 3000 });
	} else if(!!e.statusText && !!e.status && !!e.url){
		toast.add({ severity: 'error', summary: 'Tips', detail: `${e.status} ${e.statusText}: ${e.url}`, life: 3000 });
	} else {
		toast.add({ severity: 'error', summary: 'Tips', detail: `${e}`, life: 3000 });
	}
}
const getConfig  = (config, params, method) => {
	if(!window.__TAURI_INTERNALS__){
		return config
	} else if(!method || method == METHOD.GET){
		return {
			method,
			header:{
				"Content-Type": "application/json"
			},
			// body: !!params?JSON.stringify(params):null,
			...config
		}
	} else {
		const rtn = {
			method,
			header:{
				"Content-Type": "application/json"
			},
			...config
		}
		const _header = config?.header || config?.headers || {};
		if(!_header["Content-Type"] || _header["Content-Type"] == "application/json"){
			rtn.body = !!params?JSON.stringify(params):null;
		} else {
			rtn.body = !!params?params:null;
		}
		return rtn;
	}
}
async function localRequest(url, method, params, config) {
	return axios.get(getLocalUrl(url), { params, ...config }).then((res) => {
		if (res.status >= 400) {
			const error = new Error(res.message);
			error.status = res.status;
			return Promise.reject(error);
		} else {
			return res?.data;
		}
	});
}
async function request(url, method, params, config) {
	if(!window.__TAURI_INTERNALS__ || (!!location?.port && location.port>=2000)){
		switch (method) {
		  case METHOD.GET:
		    return axios.get(getUrl(url), { params, ...config }).then((res) => {
					if (res.status >= 400) {
						const error = new Error(res.message);
						error.status = res.status;
						return Promise.reject(error);
					} else {
						return res?.data;
					}
				});
		  case METHOD.POST:
		    return axios.post(getUrl(url), params, config).then((res) => res?.data).catch((e)=>{
					toastMessage(e);
				});
		  case METHOD.DELETE:
		    return axios.delete(getUrl(url), params, config).then((res) => res?.data).catch((e)=>{
					toastMessage(e);
				});
		  case METHOD.PUT:
		    return axios.put(getUrl(url), params, config).then((res) => res?.data).catch((e)=>{
					toastMessage(e);
				});
		  default:
		    return axios.get(getUrl(url), { params, ...config }).then((res) => {
					if (res.status >= 400) {
						const error = new Error(res.message);
						error.status = res.status;
						return Promise.reject(error);
					} else {
						return res?.data;
					}
				});
		}
	} else {
		const _header = config?.header || config?.headers || {};
		const isJson = !_header["Content-Type"] || _header["Content-Type"] == "application/json";
		if(!!method && method != METHOD.GET){
			return fetch(getUrl(url), getConfig(config,params, method)).then((res) => {
				console.log('response:')
				console.log(res)
				if(typeof(res) == 'object' && res.status >= 400){
					return Promise.reject(res);
				} else if(typeof(res) == 'object' && !!res.body && isJson){
					return res.json();
				} else {
					return res.text();
				}
			}).catch((e)=>{
				console.log(e)
				toastMessage(e);
			});
		} else {
			console.log(getUrl(url))
			return fetch(getUrl(url), getConfig(config,params, method)).then((res) => {
				console.log(res)
				if(typeof(res) == 'object' && res.status >= 400){
					return Promise.reject(res);
				} else if(typeof(res) == 'object' && !!res.body && isJson){
					return res.json();
				} else {
					return res.text();
				}
			}).catch((e)=>{
				console.log(e)
			});
		}
	}
}

async function requestNM(url, method, params, config) {
	if(!window.__TAURI_INTERNALS__ || (!!location?.port && location.port>=2000)){
		switch (method) {
		  case METHOD.GET:
		    return axios.get(getUrl(url), { params, ...config }).then((res) => {
					if (res.status >= 400) {
						const error = new Error(res.message);
						error.status = res.status;
						return Promise.reject(error);
					} else {
						return res?.data;
					}
				});
		  case METHOD.POST:
		    return axios.post(getUrl(url), params, config).then((res) => res?.data).catch((e)=>{
					//toastMessage(e);
				});
		  case METHOD.DELETE:
		    return axios.delete(getUrl(url), params, config).then((res) => res?.data).catch((e)=>{
					//toastMessage(e);
				});
		  case METHOD.PUT:
		    return axios.put(getUrl(url), params, config).then((res) => res?.data).catch((e)=>{
					//toastMessage(e);
				});
		  default:
		    return axios.get(getUrl(url), { params, ...config }).then((res) => {
					if (res.status >= 400) {
						const error = new Error(res.message);
						error.status = res.status;
						return Promise.reject(error);
					} else {
						return res?.data;
					}
				});
		}
	} else {
		const _header = config?.header || config?.headers || {};
		const isJson = !_header["Content-Type"] || _header["Content-Type"] == "application/json";
		return fetch(getUrl(url), getConfig(config,params, method)).then((res) => res.json()).then((res) => {
			console.log('response:')
			console.log(res)
			if(typeof(res) == 'object' && res.status >= 400){
				return Promise.reject(res);
			} else if(typeof(res) == 'object' && !!res.body && isJson){
				return res.json();
			} else {
				return res.text();
			}
		}).catch((e)=>{
			if(!!method && method != METHOD.GET){
				//toastMessage(e);
			}
		});
	}
}
async function mock(d) {
  return new Promise((resolve) => {
		resolve(d);
	});
}

async function merge(ary) {
  return axios.all(ary);
}
function spread(callback) {
  return axios.spread(callback);
}

function setAuthorization(auth, authType = AUTH_TYPE.BASIC) {
  switch (authType) {
    case AUTH_TYPE.BEARER:
      Cookie.set(xsrfHeaderName, "Bearer " + auth.token, {
        expires: auth.expireAt,
      });
      break;
    case AUTH_TYPE.BASIC:
      Cookie.set(xsrfHeaderName, "Basic " + auth.token, { expires: auth.expireAt });
      break;
    case AUTH_TYPE.AUTH1:
    case AUTH_TYPE.AUTH2:
    default:
      break;
  }
}

function removeAuthorization(authType = AUTH_TYPE.BASIC) {
  switch (authType) {
    case AUTH_TYPE.BEARER:
      Cookie.remove(xsrfHeaderName);
      break;
    case AUTH_TYPE.BASIC:
      Cookie.remove(xsrfHeaderName);
      break;
    case AUTH_TYPE.AUTH1:
    case AUTH_TYPE.AUTH2:
    default:
      break;
  }
}

function checkAuthorization(authType = AUTH_TYPE.BASIC) {
  switch (authType) {
    case AUTH_TYPE.BEARER:
      if (Cookie.get(xsrfHeaderName)) {
        return true;
      }
      break;
    case AUTH_TYPE.BASIC:
      if (Cookie.get(xsrfHeaderName)) {
        return true;
      }
      break;
    case AUTH_TYPE.AUTH1:
    case AUTH_TYPE.AUTH2:
    default:
      break;
  }
  return false;
}

function getHeaders(headers) {
  return {
    ...headers,
    // Authorization: Cookie.get(xsrfHeaderName),
  };
}

function loadInterceptors(interceptors, options) {
  const { request, response } = interceptors;
}

function parseUrlParams(url) {
  const params = {};
  if (!url || url === "" || typeof url !== "string") {
    return params;
  }
  const paramsStr = url.split("?")[1];
  if (!paramsStr) {
    return params;
  }
  const paramsArr = paramsStr.replace(/&|=/g, " ").split(" ");
  for (let i = 0; i < paramsArr.length / 2; i++) {
    const value = paramsArr[i * 2 + 1];
    params[paramsArr[i * 2]] =
      value === "true" ? true : value === "false" ? false : value;
  }
  return params;
}

export {
  METHOD,
  AUTH_TYPE,
	getUrl,
  request,
	requestNM,
	localRequest,
  merge,
  spread,
	mock,
  setAuthorization,
  removeAuthorization,
  checkAuthorization,
  loadInterceptors,
  parseUrlParams,
  getHeaders,
	getPort,
	setPort,
};
