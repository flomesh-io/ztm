use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareRequest {
  pub path: Option<String>,
  pub mime: Option<String>,
  pub group: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileInfo {
    pub name: String,
    pub size: usize,
    pub mime: String,
    pub data: Vec<u8>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareResponse {
  pub value: Option<String>,
	pub files: Option<Vec<FileInfo>>,
	pub paths: Option<Vec<String>>,
}
