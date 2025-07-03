import { platform as platformOs } from '@tauri-apps/plugin-os';
const platform = (text)=>{
	if(!window.__TAURI_INTERNALS__ ){
		return 'web'
	} else {
		return platformOs();
	}
}
function isSafariOrMacOS() {
    const ua = navigator.userAgent;
    const vendor = navigator.vendor;
    const platform = navigator.platform;

    const isSafari = /Safari/.test(ua) && /Apple Computer/.test(vendor) && !/Chrome/.test(ua);
    const isMacOS = /Macintosh|MacIntel|MacPPC|Mac68K/.test(platform);

    return isSafari || isMacOS;
}


const isPC = ()=>{
	return !!platform() && platform() != 'ios' && platform() != 'android' && platform() != 'web';
}

const isMobile = () => {
	return platform() == 'ios' || platform() == 'android';
}

const isMobileWidth = () => {
	return window.innerWidth <= window.innerHeight
}

export {
	platform, isSafariOrMacOS, isPC, isMobile, isMobileWidth
};