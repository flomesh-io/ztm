use lazy_static::lazy_static;
use libloading::{Library, Symbol};
use tauri::command;
use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::ptr;
use std::thread;
use std::sync::{Arc, Mutex};
use std::any::Any;
use tauri::AppHandle;
use url::Url;
use tauri::Manager;
use log::{trace, debug, info, warn, error};

// use oslog::{OsLogger};

// #[link(name = "pipy", kind = "framework")]
// extern {
//     fn pipy_main(argc: i32, argv: *const *const c_char) -> i32;
// }
use rsa::{Pkcs1v15Encrypt, RsaPrivateKey, RsaPublicKey};
use rsa::pkcs1::{EncodeRsaPrivateKey, LineEnding};
use rand::thread_rng;

#[command]
pub fn create_private_key() -> Result<String, String> {
	let mut rng = rand::thread_rng();
	let bits = 2048;
	let priv_key = RsaPrivateKey::new(&mut rng, bits).expect("failed to generate a key");
	// Convert private key to PEM
	match priv_key.to_pkcs1_pem(LineEnding::LF) {
		Ok(pem) => Ok(pem.to_string()),
		Err(e) => Err(format!("Failed to convert private key to PEM: {}", e)),
	}
}

#[command]
pub fn pipylib(lib: String, argv: Vec<String>, argc: i32) -> Result<String, String> {
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
					 
				 }
				 Ok(())
			});
		
		let thread_id_str = format!("{:?}", handle.thread().id());
     // 返回线程 ID
     Ok(thread_id_str)
			
}
