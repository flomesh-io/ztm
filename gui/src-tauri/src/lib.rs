use tauri::Manager;
#[tauri::command]
fn close_splashscreen(window: tauri::Window) {
    // if let Some(splashscreen) = window.get_webview_window("splashscreen") {
    //    splashscreen.close().unwrap();
    // }
    // window.get_webview_window("main").unwrap().show().unwrap();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![close_splashscreen])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
