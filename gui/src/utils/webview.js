import store from '@/store';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { Webview } from '@tauri-apps/api/webview';
import { getCurrentWindow, Window } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
// import { getCurrent as getCurrentDL } from '@tauri-apps/plugin-deep-link';

const openWebview = (app, broswer)=>{
	try{
		const platform = store.getters['account/platform'];
		const mesh = store.getters['account/selectedMesh'];
		const params = [];
		const lang = localStorage.getItem('lang');
		if(!!mesh?.name){
			params.push(`mesh=${mesh.name}`);
			if(app.url){
				app.url = app.url.replace(':mesh',mesh?.name)
			}
		} else if(!!app?.url && app.url.indexOf(':mesh')>0){
			return
		}
		
		if(!!lang){
			
			params.push(`lang=${lang}`)
		}
		if(params.length>0){
			if(app.url.indexOf('/#/') == 0){
				app.url += `?${params.join('&')}`
			}else {
				app.url += `#/?${params.join('&')}`
			}
		}
		
		console.log(app.url);
		if(!window.__TAURI_INTERNALS__  ){
			//|| platform=='android' || platform=='ios'
			if(!!app.url){	
				store.commit('notice/setApp', app);
			}
			// window.open(app.url);
			return
		}
		// const appWindow = new Window(`${app.name}-window`);
		const options = {
			url: app.url,
			proxyUrl: !!app.url?app.proxy:'',
			title: app.name,
			width:app.width||960
		};
		if(!!app.height){
			options.height = app.height;
		}
		
		if(!!app.url){
			options.proxyUrl = app.proxy
		}
		if(!options.url && !!app?.port){
			options.url = "http://"+(app?.port?.listen?.ip||'127.0.0.1')+':'+app?.port?.listen?.port;
		}
		if((platform=='android' || platform=='ios') && !broswer){
			//=============
			// invoke('load_webview_with_proxy', { 
			// 	url: options.url, 
			// 	proxyHost: (app?.port?.listen?.ip||'127.0.0.1'), 
			// 	proxyPort: app?.port?.listen?.port
			// });
			location.href=app.url;
			// getCurrentDL().then((urls)=>{
			// 	console.log(urls)
			// })
		// test todo platform=='windows' || 
		}	else if(!!options?.proxyUrl || !!broswer){
			const pluginOption = {
				name: app.name,
				label: `${app.name}_webview`,
				curl: options.url,
				proxy: options?.proxyUrl || '',
				eval: !!broswer,
				width: options.width,
				height:	options.height,
			 }
			 invoke('create_proxy_webview', pluginOption);
			 
			// windows API not available on mobile
			// options.parent = getCurrentWindow();
			// const proxyUrl = options?.proxyUrl;
			// delete options.proxyUrl;
			// const appWindow = new Window(app.name, options);
			 
			// appWindow.once('tauri://created', function (win) {
			// 	 options.x = 0;
			// 	 options.y = 0;
			// 	 if(!options.height){
			// 		 options.height = 800;
			// 	 }
				
			// 	 const pluginOption = {
			// 			name: app.name,
			// 			label: `${app.name}_webview`,
			// 			curl: options.url,
			// 			proxy: proxyUrl || ''
			// 	  }
			// 	  invoke('create_proxy_webview', pluginOption);
				 
			// });
			// appWindow.once('tauri://error', function (e) {
			// 	 console.log(e)
			// });
			 // window successfully created
		} else {
			if(!options.proxyUrl){
				delete options.proxyUrl;
			}
			const webview = new WebviewWindow(`${app.name}-webview`, options);
			webview.once('tauri://created', function (d) {
				console.log('WebviewWindow://created')
				console.log(options)
			// webview successfully created
			});
			webview.once('tauri://error', function (e) {
				console.log('WebviewWindow://error')
				console.log(e)
			// an error happened creating the webview
			});
		}
	}catch(e){
		console.log(e)
	}
	
}

export {
	openWebview
};