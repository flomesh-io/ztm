import toast from "@/utils/toast";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification
} from '@tauri-apps/plugin-notification'

//toast.add({ severity: 'contrast', summary: 'Tips', detail: "Deleted", life: 3000 });

const checkPermission = async () => {
  if (!(await isPermissionGranted())) {
    return (await requestPermission()) === 'granted'
  }
  return true
}

const send = async (title, body) => {
	if(!!window.__TAURI_INTERNALS__){
		if (!(await checkPermission())) {
			toast.add({ severity: 'contrast', summary: title, detail: body, life: 3000 });
			return 
		}
		sendNotification({ title, body })
	} else {
		toast.add({ severity: 'contrast', summary: title, detail: body, life: 3000 });
	}
}

export {
	send
};