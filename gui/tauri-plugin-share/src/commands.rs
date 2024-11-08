use tauri::{AppHandle, command, Runtime};

use crate::models::*;
use crate::Result;
use crate::ShareExt;

#[command]
pub(crate) async fn share<R: Runtime>(
    app: AppHandle<R>,
    payload: ShareRequest,
) -> Result<ShareResponse> {
    app.share().share(payload)
}
