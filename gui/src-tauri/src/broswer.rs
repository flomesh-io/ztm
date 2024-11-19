use libloading::{Library, Symbol};
use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::ptr;
use std::thread;
use tauri_utils::config::{WebviewUrl, WindowConfig};
use std::sync::{Arc, Mutex};
use std::any::Any;
use tauri::AppHandle;
use url::Url;
use tauri::Manager;
use tauri::command;
use log::{trace, debug, info, warn, error};


#[command]
pub fn load_webview_with_proxy(url: String, proxy_host: String, proxy_port: i32) -> Result<(),()> {
	#[cfg(target_os = "android")]
	let handle = thread::spawn(move || -> Result<(), String> {
				
		unsafe {
			
			use j4rs::{Instance, InvocationArg, Jvm, JvmBuilder};
			let jvm = Jvm::attach_thread_with_no_detach_on_drop().unwrap();
			// 准备参数
			let jurl = InvocationArg::try_from(url).unwrap();
			let jproxy_host = InvocationArg::try_from(proxy_host).unwrap();
			let jproxy_port = InvocationArg::try_from(proxy_port).unwrap();
			
			let args: [&InvocationArg; 3] = [&jurl, &jproxy_host, &jproxy_port];
			jvm.invoke_static(
				"com.flomesh.ztm.MainActivity",     // The Java class to invoke
				"startWebViewActivity",    // The static method of the Java class to invoke
				&args // The `InvocationArg`s to use for the invocation - empty for this example
			);
			
		 }
		 Ok(())
	});
	Ok(())
}

#[command]
pub async fn create_wry_webview(
	app: tauri::AppHandle,
	label: String,
	window_label: String,
	proxy_host: String,
	proxy_port: String,
	curl: String,
) -> Result<(),()> {
	unsafe {
		let window = app
		    .get_window(&window_label)
		    .expect("Failed to find window by label");
		// let event_loop = tao::event_loop::EventLoop::new();
		// let window = tao::window::WindowBuilder::new().build(&event_loop).unwrap();
		let proxy_config = wry::ProxyConfig::Socks5(wry::ProxyEndpoint {
			host: proxy_host,
			port: proxy_port
		});
		
		let builder = wry::WebViewBuilder::new();
		let webview = builder
		  .with_url(curl)
			.with_proxy_config(proxy_config)
			.with_bounds(wry::Rect {
			    position: tauri::LogicalPosition::new(100, 100).into(),
			    size: tauri::LogicalSize::new(960, 800).into(),
			  })
		  .build_as_child(&window)
		  .unwrap();
	}
	Ok(())
}

#[command]
pub async fn create_proxy_webview(
	app: tauri::AppHandle,
	label: String,
	name: String,
	proxy: String,
	curl: String,
) -> Result<(),()> {
	#[cfg(not(any(target_os = "ios", target_os = "android")))]
	unsafe {

		// let mut options = WindowConfig {
		// 		label: label.to_string(),
		// 		url: WebviewUrl::App(curl.parse().unwrap()),
		// 		fullscreen: true,
		// 		..Default::default()
		// };

		println!("builder!");


		let js_code = format!(r#"
			setTimeout(()=>{{
				document.querySelectorAll('a[target="_blank"]').forEach(link => {{
					link.removeAttribute('target');
					link.setAttribute('tauri-target','_blank');
				}});
			}},1000)
			document.addEventListener('click', function(event) {{
					const target = event.target;
					if (target.tagName === 'A' && target.href) {{
						event.preventDefault();
						const name = target.href.replace(/.*\/\//,'').split('/')[0].replaceAll('.','_').replaceAll('-','_');
						
						if(target.target == '_blank' || target.getAttribute('tauri-target') == '_blank'){{
							const pluginOption = {{
									name: name,
									label: name + `_webview`,
									curl: target.href,
									proxy: "{}"
							 }}
							 window.__TAURI__.core.invoke('create_proxy_webview', pluginOption);
						}} else {{
							const pluginOption = {{
									name: "{}",
									label: "{}",
									curl: target.href,
									proxy: "{}"
							 }}
							 window.__TAURI__.core.invoke('create_proxy_webview', pluginOption);
						}}
					}}
			}});
		"#, &proxy,&name,&label, &proxy);
			
		let dom_code = format!(r#"
		window.addEventListener('DOMContentLoaded', function() {{
			{}
		}})
		"#, &js_code);
			
		// let builder = tauri::WebviewBuilder::from_config(&options).on_navigation(|url| {
		//     // allow the production URL or localhost on dev
		// 	println!("on_navigation!");
		// 	if url.scheme() == "http" || url.scheme() == "https" || url.scheme() == "ipc" {
		// 		println!("{}",url);
		// 		// create_proxy_webview_core(app, url.to_string(), url.to_string(), proxy_url.to_string(), url.to_string());
		// 	}
		// 	true
		// });
		let window = match app.get_window(&name) {
				Some(window) => window, 
				None => {
						let width = 1000.;
						let height = 800.;
						tauri::window::WindowBuilder::new(&app, &name)
								.inner_size(width, height)
								.title(name)
								.build()
								.expect("Failed to create a new window")
				}
		};
  //   let window = app
  //       .get_window(&name)
  //       .expect("Failed to find window by label");
				
		// let width = 1000.;
		// let height = 800.;
		// let window = tauri::window::WindowBuilder::new(&app, &name)
		//         .inner_size(width, height).title(&name)
		//         .build().unwrap();
				
		// app.get_webview("main")
		
		
		if let Some(mut old_webview) = app.get_webview(&label) {
				// old_webview.eval(&js_code).unwrap();
				old_webview.navigate(Url::parse(&curl).expect("Invalid URL"));
				std::thread::sleep(std::time::Duration::from_secs(1));
				let webviews = window.webviews();
				for webview in &webviews {
					webview.eval(&js_code).unwrap();
				}
				// if let Some(old2_webview) = app.get_webview(&label) {
				// 	old2_webview.eval(&js_code).unwrap();
				// }
		} else {
				
			let mut builder = tauri::WebviewBuilder::new(&label, WebviewUrl::App(curl.parse().unwrap())).on_navigation(|url| {
					// allow the production URL or localhost on dev
					url.scheme() == "http" || url.scheme() == "https" || url.scheme() == "tauri" || (cfg!(dev) && url.host_str() == Some("localhost"))
				});
			if !proxy.is_empty() {
				builder = builder.proxy_url(Url::parse(&proxy).expect("Invalid URL"));
			}
			let webview = window.add_child(
				builder,
				tauri::LogicalPosition::new(0, 0),
				window.inner_size().unwrap(),
			).unwrap();
			webview.eval(&dom_code).unwrap();
		}
	}
	Ok(())
}