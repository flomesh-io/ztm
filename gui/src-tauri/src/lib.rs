use lazy_static::lazy_static;
use libloading::{Library, Symbol};
use tauri::command;
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
use tauri_plugin_shell::ShellExt;
use tauri_plugin_log::{Target, TargetKind};
use log::{trace, debug, info, warn, error};


#[cfg(target_os = "ios")]
extern crate objc;
#[cfg(target_os = "ios")]
use objc::runtime::{Class, Object};
#[cfg(target_os = "ios")]
use objc::{msg_send, sel, sel_impl};
// use oslog::{OsLogger};

// #[link(name = "pipy", kind = "framework")]
// extern {
//     fn pipy_main(argc: i32, argv: *const *const c_char) -> i32;
// }

#[command]
fn pipylib(lib: String, argv: Vec<String>, argc: i32) -> Result<String, String> {
			// 创建一个通道用于线程输出
			
			let handle = thread::spawn(move || -> Result<(), String> {
				unsafe {
					// 将Vec<String>转换为C所期望的char*数组
					let c_strings: Vec<CString> = argv.iter()
							 .map(|arg| CString::new(arg.as_str()).unwrap())
							 .collect();
					 
					// 将CString转换为指针数组
					let c_argv: Vec<*const c_char> = c_strings.iter()
							 .map(|cstr| cstr.as_ptr())
							 .collect();
					 
					// 将指针数组的指针赋值给一个变量
					let c_argv_ptr = c_argv.as_ptr();
				
					let lib = Library::new(&lib).map_err(|e| {
							let error_message = format!("Failed to load pipylib from path {}: {}", lib, e);
							// error!("{}", error_message);
							error_message
					})?;
					
					// 获取pipy_main符号
					let pipy_main: Symbol<unsafe extern "C" fn(i32, *const *const c_char) -> i32> = lib.get(b"pipy_main\0")
							.map_err(|e| e.to_string())?;


						// 调用外部函数
					 pipy_main(argc, c_argv_ptr);
					 
					 // 调用外部函数并检查返回值
					 // let result = std::panic::catch_unwind(|| {
						// 	 pipy_main(argc, c_argv_ptr)
					 // });

					 // match result {
						// 	 Ok(code) => {
						// 			 if code != 0 {
						// 					 let error_message = format!("pipy_main returned error code: {}", code);
						// 					 error!("{}", error_message);
						// 					 return Err(error_message);
						// 			 }
						// 	 }
						// 	 Err(_) => {
						// 			 let error_message = "pipy_main panicked".to_string();
						// 			 error!("{}", error_message);
						// 			 return Err(error_message);
						// 	 }
					 // }
				 }
				 Ok(())
			});
		
		let thread_id_str = format!("{:?}", handle.thread().id());
     // 返回线程 ID
     Ok(thread_id_str)
			
}


// #[command]
// fn logto(lib: String, arg: String) -> Result<String, String> {
// 			let handle = thread::spawn(move || -> Result<(), String> {
// 				unsafe {
// 					let c_arg: CString = CString::new(arg.as_str()).unwrap();
// 					let lib = Library::new(&lib).map_err(|e| {
// 							let error_message = format!("Failed to load logto from path {}: {}", lib, e);
// 							error_message
// 					})?;
					
// 					let logto: Symbol<unsafe extern "C" fn(*const c_char)> = lib.get(b"logto\0")
// 					            .map_err(|e| e.to_string())?;
// 					 logto(c_arg.as_ptr());
// 				 }
// 				 Ok(())
// 			});
		
// 		let thread_id_str = format!("{:?}", handle.thread().id());
//      Ok(thread_id_str)
			
// }
#[command]
async fn create_wry_webview(
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
async fn create_proxy_webview(
	app: tauri::AppHandle,
	label: String,
	window_label: String,
	proxy_url: String,
	curl: String,
) -> Result<(),()> {
	#[cfg(target_os = "windows")]
	{
		create_proxy_webview_core(app.clone(), label.to_string(), window_label.to_string(), proxy_url.to_string(), curl);
	}
	Ok(())
}

#[cfg(target_os = "windows")]
fn create_proxy_webview_core(
	app: tauri::AppHandle,
	label: String,
	window_label: String,
	proxy_url: String,
	curl: String,
) -> Result<(),()> {
	unsafe {

		let mut options = WindowConfig {
				label: label.to_string(),
				url: WebviewUrl::App(curl.parse().unwrap()),
				fullscreen: true,
				..Default::default()
		};

		if !proxy_url.is_empty() {
			let proxy_url_ops: Option<Url> = Some(
			        Url::parse(&proxy_url)
			            .expect("Failed to parse URL"),
			    );
			options.proxy_url = proxy_url_ops
		}
		println!("builder!");

		let builder = tauri::WebviewBuilder::from_config(&options).on_navigation(|url| {
		    // allow the production URL or localhost on dev
			println!("on_navigation!");
			if url.scheme() == "http" || url.scheme() == "https" || url.scheme() == "ipc" {
				println!("{}",url);
				// create_proxy_webview_core(app, url.to_string(), url.to_string(), proxy_url.to_string(), url.to_string());
			}
			true
		});
    let window = app
        .get_window(&window_label)
        .expect("Failed to find window by label");

		let webview = window.add_child(
			builder,
			tauri::LogicalPosition::new(0, 0),
			window.inner_size().unwrap(),
		).unwrap();
		
	}
	Ok(())
}
	
#[command]
fn load_webview_with_proxy(url: String, proxy_host: String, proxy_port: i32) -> Result<(),()> {
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


// fn request_products() {
//     unsafe {
//         // 获取 InAppPayHandler 的类对象
//         let cls = Class::get("InAppPayHandler").expect("InAppPayHandler class not found");

//         // 获取单例实例 sharedManager
//         let shared_manager: *mut Object = msg_send![cls, sharedManager];

//         // 调用 requestProducts 方法
//         let _: () = msg_send![shared_manager, requestProducts];
//     }
// }


#[command]
fn purchase_product() -> Result<String, String> {
		
		warn!("purchase_product start");
		let handle = thread::spawn(move || -> Result<(), String> {
			#[cfg(target_os = "ios")]
			unsafe {
					warn!("purchase_product in");
					let cls = Class::get("InAppPayHandler").expect("InAppPayHandler class not found");
					let shared_manager: *mut Object = msg_send![cls, sharedManager];
					// let ns_product = std::ffi::CString::new(product.clone()).unwrap();
					// let product_nsstring: *mut Object = msg_send![Class::get("NSString").unwrap(), stringWithUTF8String: ns_product.as_ptr()];
					
					let _: () = msg_send![shared_manager, purchaseProductWithID];
					warn!("purchase_product end");
			}

			// 模拟等待购买过程完成
			// tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
			
			// 假设购买成功，返回成功消息
			// Ok(format!("Purchase of product {} successful!", product))
	
			Ok(())
	
		});
		
		let thread_id_str = format!("{:?}", handle.thread().id());
		// 返回线程 ID
		Ok(thread_id_str)
}

// fn purchase_product(product: &str) {
//     unsafe {
//         // 获取 InAppPayHandler 的类对象
//         let cls = Class::get("InAppPayHandler").expect("InAppPayHandler class not found");

//         // 获取单例实例 sharedManager
//         let shared_manager: *mut Object = msg_send![cls, sharedManager];

//         // 将 Rust 字符串转换为 NSString
//         let ns_product = std::ffi::CString::new(product).unwrap();
//         let product_nsstring: *mut Object = msg_send![Class::get("NSString").unwrap(), stringWithUTF8String: ns_product.as_ptr()];

//         // 调用 purchaseProductWithID: 方法
//         let _: () = msg_send![shared_manager, purchaseProductWithID: product_nsstring];
//     }
// }

// #[command]
// fn start_apple_pay(amount: f64, currency_code: String, country_code: String) -> Result<(), String> {
//     #![cfg(target_os = "ios")]
// 		unsafe {
// 				// 1. 确认 ApplePayHandler 对象的存在
// 				let apple_pay_handler: *mut Object = msg_send![class!(ApplePayHandler), shared];
// 				if apple_pay_handler.is_null() {
// 						return Err("Failed to initialize Apple Pay handler.".into());
// 				}

// 				// 2. 将 `amount` 转换为 `NSDecimalNumber`
// 				let payment_amount: *mut Object = msg_send![class!(NSDecimalNumber), decimalNumberWithString: amount.to_string()];

// 				// 3. 创建一个 Block 来处理回调
// 				let completion_block = ConcreteBlock::new(|success: bool| {
// 						if success {
// 								println!("Apple Pay started successfully.");
// 						} else {
// 								println!("Apple Pay failed or is not available.");
// 						}
// 				});
// 				let completion_block = completion_block.copy(); // Copy the block for Objective-C

// 				// 4. 调用 Apple Pay 的方法
// 				let _: () = msg_send![apple_pay_handler, startApplePay: payment_amount
// 																	currencyCode: currency_code
// 																	countryCode: country_code
// 																	completion: completion_block];
// 		}
// 		Ok(())
// }

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
	
	// if cfg!(target_os = "ios") {
	// 	OsLogger::new("com.flomesh.ztm")
	// 	        .level_filter(LevelFilter::Debug)
	// 	        .category_level_filter("Settings", LevelFilter::Trace)
	// 	        .init()
	// 	        .unwrap();
	// }
		tauri::Builder::default()
				.plugin(tauri_plugin_os::init())
				.plugin(tauri_plugin_http::init())
				.plugin(tauri_plugin_shell::init())
				.plugin(tauri_plugin_upload::init())
				.plugin(tauri_plugin_dialog::init())
				.plugin(tauri_plugin_process::init())
				.plugin(tauri_plugin_fs::init())				
				.plugin(tauri_plugin_deep_link::init())
				.plugin(tauri_plugin_notification::init())
				.plugin(tauri_plugin_persisted_scope::init())
				.plugin(tauri_plugin_clipboard_manager::init())
				// .plugin(tauri_plugin_log::Builder::new().build())
				.plugin(tauri_plugin_log::Builder::new().targets([
            Target::new(TargetKind::Stdout),
            Target::new(TargetKind::LogDir { file_name: None }),
            Target::new(TargetKind::Webview),
        ]).build())
				// .plugin(tauri_plugin_sharesheet::init())
				.invoke_handler(tauri::generate_handler![
					pipylib,create_proxy_webview,create_wry_webview,purchase_product
				])
				.run(tauri::generate_context!())
				.expect("error while running tauri application");
}
