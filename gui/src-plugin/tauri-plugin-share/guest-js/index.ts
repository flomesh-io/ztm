import { invoke } from '@tauri-apps/api/core'

export async function shareFile(path: string, mime: string): Promise<string | null> {
  return await invoke<{value?: string}>('plugin:share|share_file', {
		path,
		mime
  }).then((r) => (r.value ? r.value : null));
}

export async function getSharedFiles(path: string, group: string): Promise<any | null> {
  return await invoke<{files?: any}>('plugin:share|get_shared_files', {
		group,
		path
  }).then((r) => (r.files ? r.files : null));
}

export async function getSharedFilesPath(path: string, group: string): Promise<any | null> {
  return await invoke<{paths?: any}>('plugin:share|get_shared_files_path', {
		group,
		path
  }).then((r) => (r.paths ? r.paths : null));
}
