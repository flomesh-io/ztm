import clipboard from 'clipboardy';
import toast from "@/utils/toast";
import { writeText, readText } from '@tauri-apps/plugin-clipboard-manager';
const copy = (text)=>{
	if(!window.__TAURI_INTERNALS__ ){
		clipboard.write(text).then(()=>{
			toast.add({ severity: 'contrast', summary: 'Tips', detail: `Copied.`, life: 3000 });
		});
	} else {console.log(text)
		writeText(text).then(()=>{
			toast.add({ severity: 'contrast', summary: 'Tips', detail: `Copied.`, life: 3000 });
		})
	}
}

export {
	copy
};