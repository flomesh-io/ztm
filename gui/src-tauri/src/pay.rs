use libloading::{Library, Symbol};
use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::ptr;
use std::thread;
use std::sync::{Arc, Mutex};
use std::any::Any;
use tauri::AppHandle;
use url::Url;
use tauri::Manager;
use tauri::command;
use log::{trace, debug, info, warn, error};

#[cfg(target_os = "ios")]
extern crate objc;
#[cfg(target_os = "ios")]
use objc::runtime::{Class, Object};
#[cfg(target_os = "ios")]
use objc::{msg_send, sel, sel_impl};
#[cfg(target_os = "ios")]
use objc_foundation::{INSString, NSString};

#[command]
pub fn purchase_product() -> Result<String, String> {
		
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

