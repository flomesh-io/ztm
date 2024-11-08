use tauri::{AppHandle, command, Runtime};

use crate::models::*;
use crate::Result;
use crate::ToolsExt;

#[command]
pub(crate) async fn ping<R: Runtime>(
    app: AppHandle<R>,
    payload: PingRequest,
) -> Result<PingResponse> {
    app.tools().ping(payload)
}

#[command]
pub(crate) async fn share<R: Runtime>(
    app: AppHandle<R>,
    payload: PingRequest,
) -> Result<PingResponse> {
    app.tools().share(payload)
}
