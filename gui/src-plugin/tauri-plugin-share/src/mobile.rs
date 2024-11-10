use serde::de::DeserializeOwned;
use tauri::{
  plugin::{PluginApi, PluginHandle},
  AppHandle, Runtime,
};

use crate::models::*;

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_share);

// initializes the Kotlin or Swift plugin classes
pub fn init<R: Runtime, C: DeserializeOwned>(
  _app: &AppHandle<R>,
  api: PluginApi<R, C>,
) -> crate::Result<Share<R>> {
  #[cfg(target_os = "android")]
  let handle = api.register_android_plugin("com.plugin.share", "SharePlugin")?;
  #[cfg(target_os = "ios")]
  let handle = api.register_ios_plugin(init_plugin_share)?;
  Ok(Share(handle))
}

/// Access to the share APIs.
pub struct Share<R: Runtime>(PluginHandle<R>);


impl<R: Runtime> Share<R> {
  pub fn share_file(&self, payload: ShareRequest) -> crate::Result<ShareResponse> {
    self
      .0
      .run_mobile_plugin("share_file", payload)
      .map_err(Into::into)
  }
  pub fn get_shared_files(&self, payload: ShareRequest) -> crate::Result<ShareResponse> {
    self
      .0
      .run_mobile_plugin("get_shared_files", payload)
      .map_err(Into::into)
  }
  pub fn get_shared_files_path(&self, payload: ShareRequest) -> crate::Result<ShareResponse> {
    self
      .0
      .run_mobile_plugin("get_shared_files_path", payload)
      .map_err(Into::into)
  }
}
