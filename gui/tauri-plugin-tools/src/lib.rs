use tauri::{
  plugin::{Builder, TauriPlugin},
  Manager, Runtime,
};

pub use models::*;

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

mod commands;
mod error;
mod models;

pub use error::{Error, Result};

#[cfg(desktop)]
use desktop::Tools;
#[cfg(mobile)]
use mobile::Tools;

/// Extensions to [`tauri::App`], [`tauri::AppHandle`] and [`tauri::Window`] to access the tools APIs.
pub trait ToolsExt<R: Runtime> {
  fn tools(&self) -> &Tools<R>;
}

impl<R: Runtime, T: Manager<R>> crate::ToolsExt<R> for T {
  fn tools(&self) -> &Tools<R> {
    self.state::<Tools<R>>().inner()
  }
}

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
  Builder::new("tools")
    .invoke_handler(tauri::generate_handler![commands::ping,commands::share])
    .setup(|app, api| {
      #[cfg(mobile)]
      let tools = mobile::init(app, api)?;
      #[cfg(desktop)]
      let tools = desktop::init(app, api)?;
      app.manage(tools);
      Ok(())
    })
    .build()
}
