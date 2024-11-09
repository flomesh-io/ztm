import { invoke } from '@tauri-apps/api/core'

export async function share(path: string, mimeType: string): Promise<string | null> {
  return await invoke<{value?: string}>('plugin:share|share', {
		path,
		mimeType
  }).then((r) => (r.value ? r.value : null));
}
