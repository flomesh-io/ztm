use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::models::*;

pub fn init<R: Runtime, C: DeserializeOwned>(
  app: &AppHandle<R>,
  _api: PluginApi<R, C>,
) -> crate::Result<Share<R>> {
  Ok(Share(app.clone()))
}

/// Access to the share APIs.
pub struct Share<R: Runtime>(AppHandle<R>);
