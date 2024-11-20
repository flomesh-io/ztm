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
use tauri_plugin_share::ShareExt;
use log::{trace, debug, info, warn, error};

mod binary;
mod pay;
mod broswer;



#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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
				.plugin(tauri_plugin_store::Builder::default().build())
				.plugin(tauri_plugin_share::init())
				.plugin(tauri_plugin_keychain::init())
				.plugin(tauri_plugin_log::Builder::new().targets([
            Target::new(TargetKind::Stdout),
            Target::new(TargetKind::LogDir { file_name: None }),
            Target::new(TargetKind::Webview),
        ]).build())
				// .plugin(tauri_plugin_sharesheet::init())
				.invoke_handler(tauri::generate_handler![
					binary::pipylib,
					binary::create_private_key,
					broswer::create_proxy_webview,
					broswer::create_wry_webview,
					pay::purchase_product
				])
				.run(tauri::generate_context!())
				.expect("error while running tauri application");
}
