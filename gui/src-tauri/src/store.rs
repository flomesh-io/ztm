use tauri::AppHandle;
use tauri::command;
use tauri_plugin_store::{Store, StoreExt};
use std::{path::PathBuf, sync::Arc, time::Duration};
use serde_json::Value as JsonValue;

#[command]
pub async fn push_store_list(
	app: tauri::AppHandle,
	key: String,
	value: JsonValue,
) -> Result<(),()> {
	unsafe {
		let store = app
        .store_builder("store.json")
        .auto_save(Duration::from_millis(100))
        .build()
        .unwrap();
			
		let mut list = store
			.get(&key)
			.and_then(|json| {
					json.as_array().map(|array| {
						array
								.iter()
								.cloned()
								.collect()
					})
			})
			.unwrap_or_else(Vec::new);
		
		list.push(value);
		
		store.set(&key, serde_json::json!(list));
	}
	Ok(())
}

#[command]
pub async fn set_store_list(
	app: tauri::AppHandle,
	key: String,
	value: Vec<JsonValue>,
) -> Result<(),()> {
	unsafe {
		let store = app
        .store_builder("store.json")
        .auto_save(Duration::from_millis(100))
        .build()
        .unwrap();
		
		store.set(&key, serde_json::json!(value));
	}
	Ok(())
}

#[command]
pub async fn get_store_list(
	app: tauri::AppHandle,
	key: String,
) -> Result<Vec<JsonValue>,()> {
	let mut list = Vec::new();
	let store = app
			.store_builder("store.json")
			.auto_save(Duration::from_millis(100))
			.build()
			.unwrap();
	
	list = store
		.get(&key)
		.and_then(|json| {
				json.as_array().map(|array| {
					array
							.iter()
							.cloned()
							.collect()
				})
		})
		.unwrap_or_else(Vec::new);
		
	Ok(list)
}