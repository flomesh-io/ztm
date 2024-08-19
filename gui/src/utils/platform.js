import { platform as platformOs } from '@tauri-apps/plugin-os';
const platform = (text)=>{
	if(!window.__TAURI_INTERNALS__ ){
		return 'web'
	} else {console.log(text)
		return platformOs();
	}
}
export {
	platform
};