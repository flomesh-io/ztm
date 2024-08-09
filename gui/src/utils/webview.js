import store from '@/store';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { Webview } from '@tauri-apps/api/webview';
import { getCurrentWindow, Window } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
// import { getCurrent as getCurrentDL } from '@tauri-apps/plugin-deep-link';

const openWebview = (app)=>{
	if(!window.__TAURI_INTERNALS__ ){
		store.commit('notice/setApp', app);
		// window.open(app.url);
		return
	}
	try{
		const platform = store.getters['account/platform']
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
		if(platform=='android' || platform=='ios' ){
			//=============
			// invoke('load_webview_with_proxy', { 
			// 	url: options.url, 
			// 	proxyHost: (app?.port?.listen?.ip||'127.0.0.1'), 
			// 	proxyPort: app?.port?.listen?.port
			// });
			// location.href=options.url;
			// getCurrentDL().then((urls)=>{
			// 	console.log(urls)
			// })
			if(app.url.indexOf('/#/') == 0){
				location.href=app.url;
			}else{
				store.commit('notice/setApp', app);
			}
		}	else if(platform=='windows'){
			// windows API not available on mobile
			options.parent = getCurrentWindow();
			delete options.proxyUrl;
			const appWindow = new Window(`${app.name}-window`,options);
			 
			appWindow.once('tauri://created', function (win) {
				 options.x = 0;
				 options.y = 0;
				 if(!options.height){
					 options.height = 800;
				 }
				 const label = `${app.name}-webview`;
				  invoke('create_proxy_webview', {
						windowLabel: appWindow.label,
						label,
						curl: options.url,
						proxyUrl: ''//options.proxyUrl
				  });
			});
			appWindow.once('tauri://error', function (e) {
				 console.log('Window://error')
			});
			 
			 // invoke('create_wry_webview', {
			 // 						windowLabel: appWindow.label,
			 // 						label,
			 // 						curl: options.url,
			 // 						proxyHost: app?.port?.listen?.ip||'127.0.0.1',
			 // 						proxyPort: `${app?.port?.listen?.port}`
			 // });
			  // const webview = new Webview(appWindow, label, options);
			  // webview.once('tauri://created', function (d) {
			  // 	console.log('Webview://created')
			  // 	console.log(d)
			  // });
			  // webview.once('tauri://error', function (e) {
			  // 	console.log('Webview://error')
			  // 	console.log(e)
			  // });
			 // window successfully created
		} else {
			if(!options.proxyUrl){
				delete options.proxyUrl;
			}
			const webview = new WebviewWindow(`${app.name}-webview`, options);
			webview.once('tauri://created', function (d) {
				console.log('WebviewWindow://created')
				console.log(d)
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