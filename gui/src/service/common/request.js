import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import axios from "axios";
import Cookie from './cookie'
import toast from "@/utils/toast";
import { writeLogFile } from '@/utils/file';

const xsrfHeaderName = "Authorization";
const DEFAULT_VITE_APP_API_PORT = import.meta.env.VITE_APP_API_PORT;
const DEFAULT_VITE_APP_HUB_LISTEN = import.meta.env.VITE_APP_HUB_LISTEN;

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
function getUrl(url,isfull){
	let path = "";
	if(location.pathname){
		let params = location.pathname.split('/');
		if(params.length >= 8){
			params.splice(params.length-1,1)
			path = params.join("/")
		}
	}
	if(url.indexOf('/api/meshes/')==0){
		path = '';
	}
	const devPath = localStorage.getItem("DEV_BASE")
	let rtn = "";
	if(url.indexOf('://')>=0){
		rtn = url
	}else if(!!devPath && url.indexOf('/api/meshes/')==-1){
		rtn = `${devPath}${url}`
	}else if(!window.__TAURI_INTERNALS__ || path.indexOf('://')>=0){
		rtn = `${path}${url}`
	} else {
		rtn = `http://127.0.0.1:${getPort()}${path}${url}`
	}
	if(!!isfull && rtn.indexOf('://')==-1){
		return `http://127.0.0.1:${getPort()}${rtn}`
	} else {
		return rtn
	}
}
const fetchBoth = !window.__TAURI_INTERNALS__?fetch:tauriFetch;

// 添加取消功能的版本
function fetchAsStream() {
  const controller = new AbortController();
  
  async function postWithStream(url, data, processMessage) {
    try {
      const response = await fetchBoth(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
				redirect: 'follow',
        body: JSON.stringify(data),
        signal: controller.signal
      });
			if (!response.ok) {
				const _msg = `HTTP error! status: ${response.status}`
				processMessage(response?.statusText || _msg, true);
				throw new Error(_msg);
				return
			}
	
			if (!response.body) {
				throw new Error('ReadableStream not supported in this browser');
				return
			}
	
	    const reader = response.body.getReader();
	    const decoder = new TextDecoder();
	    let buffer = '';
			let allbuffer = '';
	    let lastData = null;
	    while (true) {
				const { done,value } = await reader.read();
				if (done) {
					// 处理缓冲区中剩余的数据
					if (buffer.trim()) {
						processBuffer(true)
					}
					console.log('Stream complete');
					break;
				}
				
				buffer += decoder.decode(value, { stream: true });
				processBuffer(false);
	    }

			function processBuffer(ending) {
				
				// 按行分割缓冲区
				const lines = buffer.split('\n');
				
				// 保留最后不完整的行（如果有）
				buffer = lines.pop() || '';
				
				for (const line of lines) {
					allbuffer += `${line}\n`;
					if (line.startsWith('data: ')) {
						const jsonStr = line.slice(6).trim();
						if (jsonStr === '[DONE]') {
							writeLogFile('ztm-llm.log', `[${new Date().toISOString()}] llm stream: ${allbuffer}\n`);
							allbuffer = "";
							processMessage(lastData, true);
						} else {
							try {
								const data = JSON.parse(jsonStr);
								lastData = data;
								processMessage(data, false);
							} catch (e) {
								console.error('JSON parse error:', e, 'on data:', jsonStr);
							}
						}
					}
				}
			}
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('请求已被取消');
      } else {
        console.error('Fetch error:', error);
      }
    }
  }

  return {
    post: postWithStream,
    cancel: () => controller.abort()
  };
}
function getMetaUrl(url){
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
		return `http://127.0.0.1:${getPort()}${devPath}${url}`
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
const getHubListen = () => {
	const VITE_APP_HUB_LISTEN = localStorage.getItem("VITE_APP_HUB_LISTEN");
	return VITE_APP_HUB_LISTEN || DEFAULT_VITE_APP_HUB_LISTEN || '127.0.0.1:8888';
}
const setHubListen = (listen) => {
	localStorage.setItem("VITE_APP_HUB_LISTEN",listen);
}
const getHubNames = () => {
	const VITE_APP_HUB_NAMES = localStorage.getItem("VITE_APP_HUB_NAMES");
	return VITE_APP_HUB_NAMES || DEFAULT_VITE_APP_HUB_LISTEN || '127.0.0.1:8888';
}
const setHubNames = (listen) => {
	localStorage.setItem("VITE_APP_HUB_NAMES",listen);
}
function getBaseUrl() {
	return `http://localhost:${getPort()}`
}
const toastMessage = async (e) => {
	let result = '';
	if (e?.body instanceof ReadableStream) {
		const reader = e.body.getReader();
		const decoder = new TextDecoder('utf-8');
		let done = false;

		while (!done) {
			const { value, done: readerDone } = await reader.read();
			done = readerDone;
			if (value) {
				result += decoder.decode(value, { stream: !done });
			}
		}
	}
	
	if(!!result){
		toast.add({ severity: 'error', summary: 'Tips', detail: `${result}`, life: 3000 });
	}else if(!!e?.response?.status && !!e?.response?.data){
		toast.add({ severity: 'error', summary: 'Tips', detail: `[${e.response.status}] ${e.response.data?.message||e.response.data}`, life: 3000 });
	} else if(!!e.status && !!e.message){
		toast.add({ severity: 'error', summary: 'Tips', detail: `[${e.status}] ${e.message}`, life: 3000 });
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
			headers:{
				"Content-Type": "application/json"
			},
			// body: !!params?JSON.stringify(params):null,
			...config
		}
	} else {
		
		const rtn = {
			method,
			headers:{
				"Content-Type": "application/json"
			},
			...config
		}
		const _headers = rtn?.headers || {};
		if(!_headers["Content-Type"] || _headers["Content-Type"] == "application/json"){
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
		    return axios.post(getUrl(url), params, config).then((res) => {
					return res?.data
				}).catch((e)=>{
					toastMessage(e);
					throw e;
				});
		  case METHOD.DELETE:
		    return axios.delete(getUrl(url), params, config).then((res) => res?.data).catch((e)=>{
					toastMessage(e);
					throw e;
				});
		  case METHOD.PUT:
		    return axios.put(getUrl(url), params, config).then((res) => res?.data).catch((e)=>{
					toastMessage(e);
					throw e;
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
		const _header = config?.headers || {};
		const isJson = !_header["Content-Type"] || _header["Content-Type"] == "application/json";
		if(!!method && method != METHOD.GET){
			return tauriFetch(getUrl(url), getConfig(config,params, method)).then((res) => {
				if(typeof(res) == 'object' && res.status >= 400){
					return Promise.reject(res);
				} else if(typeof(res) == 'object' && !!res.body && isJson){
					if (res.headers.get('content-length') === '0') {
						return Promise.resolve(null);
					}
					return res.json();
				} else {
					return res.text();
				}
			}).catch((e)=>{
				console.log(e)
				toastMessage(e);
				throw e;
			});
		} else {
			// console.log(getUrl(url))
			// const req = tauriFetch(getUrl(url), getConfig(config,params, method));
			// return await req.body.json();
			return tauriFetch(getUrl(url), getConfig(config,params, method)).then((res) => {
				// console.log(res)
				if(typeof(res) == 'object' && res.status >= 400){
					return Promise.reject(res);
				} else if(typeof(res) == 'object' && !!res.body && isJson){
					if (res.headers.get('content-length') === '0') {
						return Promise.resolve(null);
					}
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
function requestWithTimeout(timeout = 5000, url, method, params, config) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error('timeout'));
        }, timeout);

        request(url, method, params, config)
            .then(response => {
                clearTimeout(timer); 
                resolve(response);
            })
            .catch(err => {
                clearTimeout(timer); 
                reject(err);
            });
    });
}
async function requestMeta(url) {
	return tauriFetch(url, {
		method: METHOD.GET,
		header:{
			"Content-Type": "application/json"
		}
	}).then((res) => {
		return res.arrayBuffer();
	}).catch((e)=>{
		toastMessage(e);
	});
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
		return tauriFetch(getUrl(url), getConfig(config,params, method)).then((res) => res.json()).then((res) => {
			// console.log('response:')
			// console.log(res)
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
	getMetaUrl,
  request,
	requestNM,
	requestMeta,
	requestWithTimeout,
	localRequest,
  merge,
  spread,
	mock,
  setAuthorization,
  removeAuthorization,
	fetchAsStream,
  checkAuthorization,
  loadInterceptors,
  parseUrlParams,
  getHeaders,
	getPort,
	setPort,
	getHubListen,
	setHubListen,
	getHubNames,
	setHubNames,
	getBaseUrl
};
