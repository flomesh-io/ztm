import { invoke } from '@tauri-apps/api/core'

export async function ping(value: string): Promise<string | null> {
  return await invoke<{value?: string}>('plugin:tools|ping', {
    payload: {
      value,
    },
  }).then((r) => (r.value ? r.value : null));
}

export async function share(path: string, mimeType: string): Promise<string | null> {
  return await invoke<{value?: string}>('plugin:tools|share', {
    payload: {
      path,
      mimeType
    },
  }).then((r) => (r.value ? r.value : null));
}
