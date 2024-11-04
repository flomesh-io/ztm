import toast from "@/utils/toast";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
	createChannel, 
	Importance, 
	Visibility,
	channels,
} from '@tauri-apps/plugin-notification'

//toast.add({ severity: 'contrast', summary: 'Tips', detail: "Deleted", life: 3000 });
const channelId = 'ztm-messages';
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
		sendNotification({ 
			channelId, 
			title, 
			body 
		})
	} else {
		toast.add({ severity: 'contrast', summary: title, detail: body, life: 3000 });
	}
}
const reg = async () => {
	
	if(!!window.__TAURI_INTERNALS__){
		if (await checkPermission()) {
			let has = false;
			const notificationChannels = await channels();
			notificationChannels.forEach((channel)=>{
				if(channel.id == channelId){
					has = true;
				}
			});
			if(!has){
				createChannel({
					id: channelId,
					name: 'ZTM Messages',
					lights: true,
					vibration: true,
					importance: Importance.High,
					visibility: Visibility.Private
				});
			}
		}
	}
}
export {
	send, reg
};