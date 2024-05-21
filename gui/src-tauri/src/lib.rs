use libloading::{Library, Symbol};
use tauri::command;
use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::ptr;
use std::thread;
use std::sync::mpsc;

#[command]
fn pipylib(lib: String, argv: Vec<String>, argc: i32) -> Result<i32, String> {
			// 创建一个通道用于线程输出
			//let (tx, rx) = mpsc::channel();
			//let result = pipy_main(argc, c_argv_ptr);
			let handle = thread::spawn(move || -> Result<(), String> {
						
				unsafe {
					//let (stdout_read, stdout_write) = nix::unistd::pipe().unwrap();
					//let (stderr_read, stderr_write) = nix::unistd::pipe().unwrap();
					//libc::dup2(stdout_write, libc::STDOUT_FILENO);
					//libc::dup2(stderr_write, libc::STDERR_FILENO);
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
					 //nix::unistd::close(stdout_write).unwrap();
					 //nix::unistd::close(stderr_write).unwrap();
				 }
				 Ok(())
			});
 
			// 等待线程完成并检查结果
			//handle.join().map_err(|e| format!("{:?}", e))??;
 // 创建线程来读取标准输出
     /*let tx_clone = tx.clone();
     thread::spawn(move || {
         let mut stdout = String::new();
         unsafe {
             let mut reader = io::BufReader::new(std::fs::File::from_raw_fd(stdout_read));
             reader.read_to_string(&mut stdout).unwrap();
         }
         tx_clone.send((stdout, "stdout")).unwrap();
     });*/
 
     // 创建线程来读取标准错误
     /*let tx_clone = tx.clone();
     thread::spawn(move || {
         let mut stderr = String::new();
         unsafe {
             let mut reader = io::BufReader::new(std::fs::File::from_raw_fd(stderr_read));
             reader.read_to_string(&mut stderr).unwrap();
         }
         tx_clone.send((stderr, "stderr")).unwrap();
     });*/
 
     // 主线程从通道中接收输出内容
     /*for received in rx.iter() {
         match received.1 {
             "stdout" => println!("stdout: {}", received.0),
             "stderr" => eprintln!("stderr: {}", received.0),
             _ => {}
         }
     }*/
			// 返回成功
			Ok(0)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
		tauri::Builder::default()
				.plugin(tauri_plugin_os::init())
				.plugin(tauri_plugin_http::init())
				.plugin(tauri_plugin_shell::init())
				.invoke_handler(tauri::generate_handler![
					pipylib
				])
				.run(tauri::generate_context!())
				.expect("error while running tauri application");
}
