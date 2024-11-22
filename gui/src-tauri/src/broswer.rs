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
				background-color: rgba(255, 255, 255, 0.9);
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
				border-radius: 6px;
				transition: .3s all;
				width:28px;
				height:28px;
				line-height:28px;
				text-align:center;
			}}
			.ztm-container button svg {{
				margin-top:4px;
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
			.go-star-full{{
				display:none;
			}}
			.ztm-history {{
				position: fixed;
				background-color: white;
				box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
				padding: 0px;
				border-radius: 6px;
				right:0px;
				top:50px;
				overflow:hidden;
			}}
			.ztm-history ul {{
				list-style: none;
				margin: 0;
				padding: 0;
			}}
			.ztm-history ul li {{
				padding: 8px 16px;
				cursor: pointer;
				background-color: #ffffff;
				transition: .3s all;
			}}
			.ztm-history ul li:hover {{
				background-color: #f0f0f0;
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
				.ztm-history {{
					background-color: #2B2B29;
				}}
				.ztm-history ul li {{
					background-color: #2B2B29;
				}}
				.ztm-history ul li:hover {{
					background-color: #444444;
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
					<button class="go-star-empty">
						<svg t="1732170774781" class="ztm-icon" viewBox="0 0 1025 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1294" width="18" height="18"><path d="M778.47986 1002.496c-12.288 0-24.576-3.072-37.888-10.24L533.74386 883.712c-5.12-3.072-12.288-5.12-20.48-5.12-7.168 0-15.36 2.048-20.48 4.096L286.95986 992.256c-12.288 7.168-24.576 10.24-38.912 10.24-24.576 0-48.128-11.264-64.512-29.696-16.384-18.432-22.528-43.008-18.432-67.584l39.936-229.376c2.048-14.336-3.072-28.672-13.312-38.912L25.83986 476.16C2.28786 453.632-5.90414 420.864 4.33586 390.144c10.24-30.72 35.84-52.224 67.584-57.344l229.376-33.792c14.336-2.048 27.648-11.264 33.792-23.552l102.4-208.896c14.336-28.672 43.008-46.08 74.752-46.08 31.744 0 60.416 17.408 74.752 46.08l102.4 208.896c7.168 13.312 19.456 21.504 33.792 23.552L952.55986 332.8c31.744 5.12 57.344 26.624 67.584 56.32 10.24 30.72 2.048 63.488-20.48 86.016L834.79986 636.928c-11.264 10.24-15.36 24.576-13.312 38.912l38.912 228.352c4.096 24.576-2.048 49.152-18.432 67.584-15.36 19.456-38.912 30.72-63.488 30.72z m-13.312-62.464c5.12 2.048 9.216 3.072 12.288 3.072 7.168 0 14.336-3.072 19.456-9.216 5.12-6.144 6.144-14.336 5.12-19.456L763.11986 686.08c-6.144-32.768 5.12-68.608 29.696-91.136l164.864-162.816c6.144-6.144 8.192-15.36 6.144-25.6-3.072-9.216-10.24-15.36-20.48-16.384l-229.376-33.792c-33.792-5.12-63.488-25.6-77.824-56.32L533.74386 92.16c-4.096-9.216-12.288-13.312-21.504-13.312-9.216 0-17.408 5.12-22.528 14.336l-102.4 206.848c-14.336 29.696-44.032 51.2-77.824 56.32L80.11086 390.144c-9.216 2.048-16.384 8.192-19.456 16.384v1.024c-3.072 9.216-1.024 17.408 6.144 24.576l165.888 162.816c24.576 23.552 34.816 57.344 29.696 91.136L223.47086 914.432c-1.024 5.12-1.024 12.288 5.12 18.432 5.12 6.144 12.288 9.216 19.456 9.216 5.12 0 8.192-1.024 11.264-2.048l206.848-108.544c13.312-8.192 29.696-12.288 47.104-12.288 15.36 0 31.744 4.096 47.104 12.288l204.8 108.544z" p-id="1295"></path></svg>
					</button>
					<button class="go-star-full">
						<svg style="fill: orange;margin-top:3px" t="1732179247794" class="ztm-icon" viewBox="0 0 1426 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1440" width="22" height="22"><path d="M985.6 1022.976c-14.848 0-31.744-4.096-47.104-12.288L716.288 899.584l-223.744 111.104c-14.336 7.68-30.208 11.776-47.104 11.776-21.504 0-42.496-6.656-59.392-19.456-31.232-23.552-47.104-64-39.936-101.376l45.568-237.056-175.616-163.328c-27.136-27.648-37.376-67.072-27.136-104.448l0.512-1.024c12.8-38.4 44.544-65.024 82.944-70.144l243.712-44.544L625.152 58.88C642.56 23.552 678.4 1.024 716.288 1.024c39.424 0 76.288 23.552 91.648 58.368l109.056 221.696 243.712 42.496c38.4 5.632 70.656 33.28 81.408 71.168 12.288 36.864 2.048 77.312-25.6 104.96l-0.512 0.512-174.592 164.864 44.032 237.568c7.168 37.888-8.192 76.288-39.424 100.352-17.92 12.8-38.912 19.968-60.416 19.968z" p-id="1441"></path></svg>
					</button>
					<button class="go-hide">
						<svg style="margin-top:3px" t="1732161039831" class="ztm-icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1320" width="22" height="22"><path d="M332.8 729.6l34.133333-34.133333c42.666667 12.8 93.866667 21.333333 145.066667 21.333333 162.133333 0 285.866667-68.266667 375.466667-213.333333-46.933333-72.533333-102.4-128-166.4-162.133334l29.866666-29.866666c72.533333 42.666667 132.266667 106.666667 183.466667 192-98.133333 170.666667-243.2 256-426.666667 256-59.733333 4.266667-119.466667-8.533333-174.933333-29.866667z m-115.2-64c-51.2-38.4-93.866667-93.866667-132.266667-157.866667 98.133333-170.666667 243.2-256 426.666667-256 38.4 0 76.8 4.266667 110.933333 12.8l-34.133333 34.133334c-25.6-4.266667-46.933333-4.266667-76.8-4.266667-162.133333 0-285.866667 68.266667-375.466667 213.333333 34.133333 51.2 72.533333 93.866667 115.2 128l-34.133333 29.866667z m230.4-46.933333l29.866667-29.866667c8.533333 4.266667 21.333333 4.266667 29.866666 4.266667 46.933333 0 85.333333-38.4 85.333334-85.333334 0-12.8 0-21.333333-4.266667-29.866666l29.866667-29.866667c12.8 17.066667 17.066667 38.4 17.066666 64 0 72.533333-55.466667 128-128 128-17.066667-4.266667-38.4-12.8-59.733333-21.333333zM384 499.2c4.266667-68.266667 55.466667-119.466667 123.733333-123.733333 0 4.266667-123.733333 123.733333-123.733333 123.733333zM733.866667 213.333333l29.866666 29.866667-512 512-34.133333-29.866667L733.866667 213.333333z" p-id="1321"></path></svg>
					</button>
					<button class="go-more">
						<svg t="1732180054163" class="ztm-icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1500" width="18" height="18"><path d="M426.666667 810.666667a85.333333 85.333333 0 1 1 170.666666 0 85.333333 85.333333 0 0 1-170.666666 0z m0-298.666667a85.333333 85.333333 0 1 1 170.666666 0 85.333333 85.333333 0 0 1-170.666666 0z m0-298.666667a85.333333 85.333333 0 1 1 170.666666 0 85.333333 85.333333 0 0 1-170.666666 0z" p-id="1501"></path></svg>
					</button>
				</div>
			</div>
			<div class="ztm-history" style="display:none"></div>
		"#);
		let dom_code = format!(r#"
			const toggleStarIcon = () => {{
				const _store_history = window.store_history || [];
				const _href = location.href;
				const starEmptyElement = document.querySelector('.ztm-container .go-star-empty');
				const starFullElement = document.querySelector('.ztm-container .go-star-full');
				if(_store_history.findIndex((n) => n.href == _href )>=0){{
					starEmptyElement.style.display = "none";
					starFullElement.style.display = "block";
				}} else {{
					starEmptyElement.style.display = "block";
					starFullElement.style.display = "none";
				}}
			}}
			const renderHistory = () => {{
				const _store_history = window.store_history || [];
				const _ary = [];
				_store_history.forEach((n)=>{{
					const name = n.href.replace(/.*\/\//,'').split('/')[0].replaceAll('.','_').replaceAll('-','_');
					_ary.push(`<li data-href="${{n.href}}" title="${{n.title}}" >${{n.title}}</li>`)
				}})
				let _html = `<ul>${{_ary.join("")}}</ul>`
				const historyMenu = document.querySelector('.ztm-history');
				historyMenu.innerHTML = _html;
			}}
			const loadHistory = () => {{
				window.__TAURI__.core.invoke('get_store_list', {{
					key: 'history'
				}}).then((res)=>{{
					window.store_history = res;
					toggleStarIcon();
					renderHistory();
				}});
			}}
			const removeHistory = (href) => {{
				const _store_history = window.store_history || [];
				const idx = _store_history.findIndex((n) => n.href == href);
				if(idx>=0){{
					_store_history.splice(idx,1);
				}}
			
				window.__TAURI__.core.invoke('set_store_list', {{
					key: 'history',
					value: _store_history
				}}).then((res)=>{{
					window.store_history = _store_history;
					toggleStarIcon();
					renderHistory();
				}});
				
			}}
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
								ztmNav(url)
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
							ztmNav(location.href)
						}});
					}}
					
					
					const starEmptyElement = document.querySelector('.ztm-container .go-star-empty');
					if(starEmptyElement){{
						starEmptyElement.addEventListener('click', function (event) {{
							window.__TAURI__.core.invoke('push_store_list', {{
								key: 'history',
								value: {{
									href: location.href,
									title: document.title
								}}
							}}).then(() => {{
								loadHistory();
							}});
						}});
					}}
					const starFullElement = document.querySelector('.ztm-container .go-star-full');
					if(starFullElement){{
						starFullElement.addEventListener('click', function (event) {{
							removeHistory(location.href);
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
					const moreElement = document.querySelector('.ztm-container .go-more');
					if(moreElement){{
						moreElement.addEventListener('click', function (event) {{
							const historyMenu = document.querySelector('.ztm-history');
							historyMenu.style.display=historyMenu.style.display=="none"?"block":"none";
						}});
					}}
					const historyElement = document.querySelector('.ztm-history');
					if(historyElement){{
						historyElement.addEventListener('click', function (event) {{
							const href = event.target.dataset?.href;
							if(!!href){{
								const name = href.replace(/.*\/\//,'').split('/')[0].replaceAll('.','_').replaceAll('-','_');
								ztmNav(href, `${{name}}_new`, `${{name}}_webview_new`);
							}}
						}});
					}}
				}},600);
				loadHistory();
			}}
		"#,&css_code, &html_code);
		let js_code = format!(r#"
			const ztmNav = (curl, name, label) => {{
				const pluginOption = {{
						name: name || "{}",
						label: label || "{}",
						curl,
						proxy: "{}",
						eval: true,
				 }}
				 window.__TAURI__.core.invoke('create_proxy_webview', pluginOption);
			}}
			
			(function() {{
				
				window.location.assign = function(url) {{
					
					ztmNav(url)
				}};
			
				window.location.replace = function(url) {{
					
					ztmNav(url)
				}};
				
			}})();
			const doLinkClick = (target) => {{
				if(target?.href){{
					const name = target.href.replace(/.*\/\//,'').split('/')[0].replaceAll('.','_').replaceAll('-','_');
					if(target.target == '_blank' || target.getAttribute('tauri-target') == '_blank'){{
						ztmNav(target.href, name, name + `_webview`)
					}} else {{
						ztmNav(target.href)
					}}
				}}
			}}
			const loadFilter = () => {{
				if(!!document.querySelector('.ztm-root')) {{
					return;
				}}
				setTimeout(()=>{{
					document.querySelectorAll('a[target="_blank"]').forEach(link => {{
						link.removeAttribute('target');
						link.setAttribute('tauri-target','_blank');
					}});
				}},1000)
				document.addEventListener('click', function(event) {{
						const target = event.target;
						if (target?.tagName === 'A') {{
							event.preventDefault();
							doLinkClick(target)
						}} else if (target?.parentNode?.tagName === 'A') {{
							event.preventDefault();
							doLinkClick(target.parentNode)
						}} else if (target?.parentNode?.parentNode?.tagName === 'A') {{
							event.preventDefault();
							doLinkClick(target.parentNode.parentNode)
						}} else if (target?.parentNode?.parentNode?.parentNode?.tagName === 'A') {{
							event.preventDefault();
							doLinkClick(target.parentNode.parentNode.parentNode)
						}} else if (target?.parentNode?.parentNode?.parentNode?.parentNode?.tagName === 'A') {{
							event.preventDefault();
							doLinkClick(target.parentNode.parentNode.parentNode.parentNode)
						}} else if (target?.parentNode?.parentNode?.parentNode?.parentNode?.parentNode?.tagName === 'A') {{
							event.preventDefault();
							doLinkClick(target.parentNode.parentNode.parentNode.parentNode.parentNode)
						}}
				}});
			}}
		"#, &name,&label,&proxy);
			
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