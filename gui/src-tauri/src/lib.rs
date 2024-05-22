use libloading::{Library, Symbol};
use tauri::command;
use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::ptr;
use std::thread;

#[command]
fn pipylib(lib: String, argv: Vec<String>, argc: i32) -> Result<String, String> {
			// 创建一个通道用于线程输出
			let handle = thread::spawn(move || -> Result<(), String> {
						
				unsafe {
					// 加载动态库
					let lib = Library::new(&lib).map_err(|e| e.to_string())?;
					
					// 获取pipy_main符号
					let pipy_main: Symbol<unsafe extern "C" fn(i32, *const *const c_char) -> i32> = lib.get(b"pipy_main\0")
							.map_err(|e| e.to_string())?;
					
			
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


						// 调用外部函数
					 pipy_main(argc, c_argv_ptr);
				 }
				 Ok(())
			});
			
		let thread_id_str = format!("{:?}", handle.thread().id());
     // 返回线程 ID
     Ok(thread_id_str)
			
}

#[command]
fn pausepipy(thread_id: String) -> Result<(), String> {
	Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
		tauri::Builder::default()
				.plugin(tauri_plugin_os::init())
				.plugin(tauri_plugin_http::init())
				.plugin(tauri_plugin_shell::init())
				.invoke_handler(tauri::generate_handler![
					pipylib,pausepipy
				])
				.run(tauri::generate_context!())
				.expect("error while running tauri application");
}
