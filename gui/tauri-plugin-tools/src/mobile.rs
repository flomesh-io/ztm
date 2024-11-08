use serde::de::DeserializeOwned;
use tauri::{
  plugin::{PluginApi, PluginHandle},
  AppHandle, Runtime,
};

use crate::models::*;

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_tools);

// initializes the Kotlin or Swift plugin classes
pub fn init<R: Runtime, C: DeserializeOwned>(
  _app: &AppHandle<R>,
  api: PluginApi<R, C>,
) -> crate::Result<Tools<R>> {
  #[cfg(target_os = "android")]
  let handle = api.register_android_plugin("com.plugin.tools", "ToolPlugin")?;
  #[cfg(target_os = "ios")]
  let handle = api.register_ios_plugin(init_plugin_tools)?;
  Ok(Tools(handle))
}

/// Access to the tools APIs.
pub struct Tools<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> Tools<R> {
  pub fn ping(&self, payload: PingRequest) -> crate::Result<PingResponse> {
    self
      .0
      .run_mobile_plugin("ping", payload)
      .map_err(Into::into)
  }
}

impl<R: Runtime> Tools<R> {
  pub fn share(&self, payload: ShareRequest) -> crate::Result<PingResponse> {
    self
      .0
      .run_mobile_plugin("share", payload)
      .map_err(Into::into)
  }
}
