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
	eval: bool,
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
		let css_code = format!(r#"
			.ztm-root {{
				width: 100%; 
				z-index:10000;
				position:relative;
			}}
			.ztm-content {{
				width: 100%; 
				height:50px;
			}}
			.ztm-show {{
				display:none;
				background-color: rgba(255, 255, 255, 0.7);
				box-shadow: 0 0 3px 3px rgba(0,0,0,0.1);
				backdrop-filter: blur(10px);
				border-radius: 6px 0 0 6px;
				position:fixed;
				right:0;
				top:100px;
				width: 30px;
				height:30px;
				line-height:30px;
				text-align:center;
				opacity:0.8;
				cursor:pointer;
				transition:.3s all;
			}}
			.ztm-show:hover{{
				opacity:1;
				background-color: #f5f5f5;
			}}
			.ztm-container {{
				background-color: rgba(255, 255, 255, 0.7);
				backdrop-filter: blur(10px);
				z-index:10000;
				position:fixed;
				left:0;
				right:0;
				top:0;
				width: 100%;  
				height:50px;
				border-bottom:1px solid #dddddd;
				line-height:50px;
				display: flex;
				align-items: center; 
				justify-content: space-between;  
			}}
							
			.ztm-left {{
				display: flex;
				gap: 10px;  
				padding:10px 10px;
			}}
							
			.ztm-container button {{
				padding:0;
				border: none;
				background-color: transparent;
				cursor: pointer;
				border-radius: 15px;
				transition: .3s all;
				width:28px;
				height:28px;
				line-height:28px;
				text-align:center;
			}}
							
			.ztm-container button:hover {{
				background-color: #f5f5f5;
			}}
							
			.ztm-right {{
				flex: 1;  
				display: flex;
				padding:5px 0px 5px 0px;
				position:relative;
			}}
			.ztm-icon {{
				
			}}
			.ztm-right .ztm-icon {{
				position:absolute;
				z-index:2;
				left:10px;
				top:12px;
			}}
			.ztm-right input {{
				width: 100%;  
				padding:0px 10px 0px 30px;
				height:30px;
				line-height:30px;
				background-color: #f5f5f5;
				border: none;
				font-size:8pt;
				border-radius: 20px;
			}}
			
			@media (prefers-color-scheme: dark) {{
				
				.ztm-show {{
					background-color: #2B2B29;
					box-shadow: 0 0 3px 3px rgba(0,0,0,0.8);
				}}
				.ztm-show:hover{{
					opacity:1;
					background-color: #444444;
				}}
				.ztm-container {{
					background-color: #2B2B29;
					color: #eeeeee;
				}}
				.ztm-container {{
					border-bottom:1px solid #666666;
				}}
				.ztm-right input, .ztm-left button:hover {{
					background-color: #444444;
					color: #eeeeee !important;
				}}
				.ztm-icon{{
					fill: #eeeeee;
				}}
			}}
		"#);
		let html_code = format!(r#" 
			<div class="ztm-content"></div>
			<div class="ztm-container">
				<div class="ztm-left">
					<button class="go-back">
						<svg t="1732001278031" class="ztm-icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1093" width="18" height="18"><path d="M932.039565 483.875452 163.745365 483.875452l350.590843-311.627437c11.008728-9.784854 12.000312-26.6428 2.215458-37.651528-9.7869-11.005658-26.63973-11.999288-37.652552-2.214435L74.241888 492.064972c-5.693676 5.062296-8.950859 12.31549-8.950859 19.934005s3.257184 14.871709 8.950859 19.934005l404.65825 359.684966c5.080715 4.51585 11.405771 6.735401 17.708314 6.735401 7.352455 0 14.675234-3.022847 19.944238-8.950859 9.784854-11.008728 8.79327-27.865651-2.215458-37.652552L160.472831 537.214265l771.566734 0c14.729469 0 26.669406-11.94096 26.669406-26.669406C958.708971 495.815389 946.769035 483.875452 932.039565 483.875452z" p-id="1094"></path></svg>
					</button>
					<button class="go-next">
						<svg t="1732001333218" class="ztm-icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1254" width="18" height="18"><path d="M572.59 881.41c-7.68 0-15.35-2.93-21.21-8.79-11.72-11.72-11.72-30.7 0-42.42l339.41-339.41c11.72-11.72 30.7-11.72 42.42 0 11.72 11.71 11.72 30.71 0 42.42L593.8 872.62a29.91 29.91 0 0 1-21.21 8.79z" p-id="1255"></path><path d="M912 542c-7.68 0-15.35-2.93-21.21-8.79L551.38 193.8c-11.72-11.71-11.72-30.71 0-42.42 11.72-11.72 30.7-11.72 42.42 0l339.41 339.41c11.72 11.71 11.72 30.71 0 42.42A29.893 29.893 0 0 1 912 542z" p-id="1256"></path><path d="M912 542H112c-16.57 0-30-13.43-30-30s13.43-30 30-30h800c16.56 0 30 13.43 30 30s-13.44 30-30 30z" p-id="1257"></path></svg>
					</button>
					<button class="go-reload">
						<svg t="1732001357036" class="ztm-icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1417" width="18" height="18"><path d="M927.999436 531.028522a31.998984 31.998984 0 0 0-31.998984 31.998984c0 51.852948-10.147341 102.138098-30.163865 149.461048a385.47252 385.47252 0 0 1-204.377345 204.377345c-47.32295 20.016524-97.6081 30.163865-149.461048 30.163865s-102.138098-10.147341-149.461048-30.163865a385.47252 385.47252 0 0 1-204.377345-204.377345c-20.016524-47.32295-30.163865-97.6081-30.163865-149.461048s10.147341-102.138098 30.163865-149.461048a385.47252 385.47252 0 0 1 204.377345-204.377345c47.32295-20.016524 97.6081-30.163865 149.461048-30.163865a387.379888 387.379888 0 0 1 59.193424 4.533611l-56.538282 22.035878A31.998984 31.998984 0 1 0 537.892156 265.232491l137.041483-53.402685a31.998984 31.998984 0 0 0 18.195855-41.434674L639.723197 33.357261a31.998984 31.998984 0 1 0-59.630529 23.23882l26.695923 68.502679a449.969005 449.969005 0 0 0-94.786785-10.060642c-60.465003 0-119.138236 11.8488-174.390489 35.217667a449.214005 449.214005 0 0 0-238.388457 238.388457c-23.361643 55.252253-35.22128 113.925486-35.22128 174.390489s11.8488 119.138236 35.217668 174.390489a449.214005 449.214005 0 0 0 238.388457 238.388457c55.252253 23.368867 113.925486 35.217667 174.390489 35.217667s119.138236-11.8488 174.390489-35.217667A449.210393 449.210393 0 0 0 924.784365 737.42522c23.368867-55.270316 35.217667-113.925486 35.217667-174.390489a31.998984 31.998984 0 0 0-32.002596-32.006209z" p-id="1418"></path></svg>
					</button>
				</div>
				<div class="ztm-right">
					<svg t="1732001390375" class="ztm-icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1578" width="14" height="14"><path d="M963.584 934.912L711.68 683.008C772.096 615.424 808.96 527.36 808.96 430.08 808.96 221.184 638.976 51.2 430.08 51.2S51.2 221.184 51.2 430.08s169.984 378.88 378.88 378.88c97.28 0 185.344-36.864 252.928-97.28l251.904 251.904c4.096 4.096 9.216 6.144 14.336 6.144s10.24-2.048 14.336-6.144c8.192-8.192 8.192-20.48 0-28.672zM430.08 768C243.712 768 92.16 616.448 92.16 430.08S243.712 92.16 430.08 92.16s337.92 151.552 337.92 337.92-151.552 337.92-337.92 337.92z" p-id="1579"></path></svg>
					<input type="text" placeholder="" value="${{location.href}}" />
				</div>
				<div class="ztm-left">
					<button class="go-hide">
						<svg style="margin-top:3px" t="1732161039831" class="ztm-icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1320" width="22" height="22"><path d="M332.8 729.6l34.133333-34.133333c42.666667 12.8 93.866667 21.333333 145.066667 21.333333 162.133333 0 285.866667-68.266667 375.466667-213.333333-46.933333-72.533333-102.4-128-166.4-162.133334l29.866666-29.866666c72.533333 42.666667 132.266667 106.666667 183.466667 192-98.133333 170.666667-243.2 256-426.666667 256-59.733333 4.266667-119.466667-8.533333-174.933333-29.866667z m-115.2-64c-51.2-38.4-93.866667-93.866667-132.266667-157.866667 98.133333-170.666667 243.2-256 426.666667-256 38.4 0 76.8 4.266667 110.933333 12.8l-34.133333 34.133334c-25.6-4.266667-46.933333-4.266667-76.8-4.266667-162.133333 0-285.866667 68.266667-375.466667 213.333333 34.133333 51.2 72.533333 93.866667 115.2 128l-34.133333 29.866667z m230.4-46.933333l29.866667-29.866667c8.533333 4.266667 21.333333 4.266667 29.866666 4.266667 46.933333 0 85.333333-38.4 85.333334-85.333334 0-12.8 0-21.333333-4.266667-29.866666l29.866667-29.866667c12.8 17.066667 17.066667 38.4 17.066666 64 0 72.533333-55.466667 128-128 128-17.066667-4.266667-38.4-12.8-59.733333-21.333333zM384 499.2c4.266667-68.266667 55.466667-119.466667 123.733333-123.733333 0 4.266667-123.733333 123.733333-123.733333 123.733333zM733.866667 213.333333l29.866666 29.866667-512 512-34.133333-29.866667L733.866667 213.333333z" p-id="1321"></path></svg>
					</button>
				</div>
			</div>
		"#);
		let dom_code = format!(r#"
			const loadDom = () => {{
				if(!document?.body || !!document.querySelector('.ztm-root')) {{
					return;
				}}
				const style = document.createElement('style');
				style.textContent = `{}`;
				document.head.appendChild(style);
				const showIcon = document.createElement('div');
				showIcon.className = 'ztm-show';
				showIcon.innerHTML = `<svg style="margin-top:4px" t="1732161342634" class="ztm-icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1466" width="22" height="22"><path d="M512 298.666667c-162.133333 0-285.866667 68.266667-375.466667 213.333333 89.6 145.066667 213.333333 213.333333 375.466667 213.333333s285.866667-68.266667 375.466667-213.333333c-89.6-145.066667-213.333333-213.333333-375.466667-213.333333z m0 469.333333c-183.466667 0-328.533333-85.333333-426.666667-256 98.133333-170.666667 243.2-256 426.666667-256s328.533333 85.333333 426.666667 256c-98.133333 170.666667-243.2 256-426.666667 256z m0-170.666667c46.933333 0 85.333333-38.4 85.333333-85.333333s-38.4-85.333333-85.333333-85.333333-85.333333 38.4-85.333333 85.333333 38.4 85.333333 85.333333 85.333333z m0 42.666667c-72.533333 0-128-55.466667-128-128s55.466667-128 128-128 128 55.466667 128 128-55.466667 128-128 128z" p-id="1467"></path></svg>`;
				const newDiv = document.createElement('div');
				newDiv.className = 'ztm-root';
				newDiv.innerHTML = `{}`;
				document.body.prepend(newDiv);
				document.body.prepend(showIcon);
				setTimeout(()=>{{
					const inputElement = document.querySelector('.ztm-container input');
					if(inputElement){{
						inputElement.addEventListener('keydown', function (event) {{
							if (event.key === 'Enter') {{
								const href = inputElement.value||'';
								const url = href.indexOf('http')==0?href:`http://${{href}}`
								const name = url.replace(/.*\/\//,'').split('/')[0].replaceAll('.','_').replaceAll('-','_');
								ztmNav("{}", "{}", url)
							}}
						}});
					}}
					const backElement = document.querySelector('.ztm-container .go-back');
					if(backElement){{
						backElement.addEventListener('click', function (event) {{
							history.go(-1);
						}});
					}}
					const nextElement = document.querySelector('.ztm-container .go-next');
					if(nextElement){{
						nextElement.addEventListener('click', function (event) {{
							history.go(1)
						}});
					}}
					const reloadElement = document.querySelector('.ztm-container .go-reload');
					if(reloadElement){{
						reloadElement.addEventListener('click', function (event) {{
							ztmNav("{}", "{}", location.href)
						}});
					}}
					const hideElement = document.querySelector('.ztm-container .go-hide');
					if(hideElement){{
						hideElement.addEventListener('click', function (event) {{
							newDiv.style.display="none";
							showIcon.style.display="block";
						}});
					}}
					const showElement = document.querySelector('.ztm-show');
					if(showElement){{
						showElement.addEventListener('click', function (event) {{
							newDiv.style.display="block";
							showIcon.style.display="none";
						}});
					}}
				}},600)
			}}
		"#,&css_code, &html_code,&name,&label,&name,&label);
		let js_code = format!(r#"
			const ztmNav = (name, label, curl) => {{
				const pluginOption = {{
						name,
						label,
						curl,
						proxy: "{}",
						eval: true,
				 }}
				 window.__TAURI__.core.invoke('create_proxy_webview', pluginOption);
			}}
			
			(function() {{
				
				window.location.assign = function(url) {{
					
					ztmNav("{}", "{}",url)
				}};
			
				window.location.replace = function(url) {{
					
					ztmNav("{}", "{}",url)
				}};
				
			}})();
			const loadFilter = () => {{
			
				if(!!document.querySelector('.ztm-root')) {{
					return;
				}}
				console.log(9)
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
								ztmNav(name, name + `_webview`,target.href)
							}} else {{
								ztmNav("{}", "{}",target.href)
							}}
						}}
				}});
			}}
		"#, &proxy,&name,&label,&name,&label,&name,&label);
			
		let init_code = format!(r#"
		{}
		{}
		const timmer = () => {{
			if(!!document && !!document?.body && !document.querySelector('.ztm-root')) {{
				loadFilter();
				loadDom();
			}} else {{
				setTimeout(()=>{{
					timmer();
				}},2000)
			}}
		}}
		timmer();
		window.addEventListener('DOMContentLoaded', function() {{
			if(!!document && !!document?.body && !document.querySelector('.ztm-root')) {{
				loadFilter();
				loadDom();
			}}
		}})
		window.addEventListener('load', function() {{
			if(!!document && !!document?.body && !document.querySelector('.ztm-root')) {{
				loadFilter();
				loadDom();
			}}
		}})
		"#,&dom_code, &js_code);
			
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
				if eval {
					std::thread::sleep(std::time::Duration::from_secs(1));
					let webviews = window.webviews();
					for webview in &webviews {
						webview.eval(&init_code).unwrap();
					}
					std::thread::sleep(std::time::Duration::from_secs(3));
					for webview in &webviews {
						webview.eval(&init_code).unwrap();
					}
					std::thread::sleep(std::time::Duration::from_secs(3));
					for webview in &webviews {
						webview.eval(&init_code).unwrap();
					}
					std::thread::sleep(std::time::Duration::from_secs(3));
					for webview in &webviews {
						webview.eval(&init_code).unwrap();
					}
					std::thread::sleep(std::time::Duration::from_secs(3));
					for webview in &webviews {
						webview.eval(&init_code).unwrap();
					}
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
			if eval {
				webview.eval(&init_code).unwrap();
			}
		}
	}
	Ok(())
}