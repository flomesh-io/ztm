
// #[command]
// fn shareFile(app: tauri::AppHandle, url: String, mimeType: String) -> Result<String, String> {
//     let handle = thread::spawn(move || -> Result<(), String> {
//         #[cfg(target_os = "ios")]
//         unsafe {
//             warn!("share in");
//             let cls = Class::get("ShareHandler").expect("ShareHandler class not found");
//             let shared_manager: *mut Object = msg_send![cls, sharedManager];
            
// 						let ns_url_class = Class::get("NSURL").expect("NSURL class not found");
// 						let ns_url: *mut Object = msg_send![ns_url_class, URLWithString: NSString::from_str(&url)];
// 						let _: () = msg_send![shared_manager, shareFile: ns_url];
						
//             warn!("share end");
//         }
//         Ok(())
//     });
//     let thread_id_str = format!("{:?}", handle.thread().id());
//     Ok(thread_id_str)
// }