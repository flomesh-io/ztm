import browser from "@/assets/img/apps/browser.png";
import proxy from "@/assets/img/apps/proxy.png";
import terminal from "@/assets/img/apps/terminal.png";
import scriptIcon from "@/assets/img/apps/script.png";
import tunnel from "@/assets/img/apps/tunnel.png";
import setting from "@/assets/img/apps/setting.png";
import consoleIcon from "@/assets/img/apps/console.png";
import ztmlog from "@/assets/img/apps/ztmlog.png";
import eplog from "@/assets/img/apps/eplog.png";
import BrowserComponent from '@/views/apps/core/Browser.vue';
import SettingComponent from '@/views/apps/core/Setting.vue';
import { platform } from '@tauri-apps/plugin-os';
const defaultApp = [{
		name: "setting",
	},{
		name: "ZTMGui",
		label: "ZTM Gui",
		url:'/#/mesh/list',
		width:1280,
		height:860,
		icon: consoleIcon,
	},{
	// 	name: "ZTMCli",
	// 	label: "ZTM Cli",
	// 	url:'/#/app/term',
	// 	width:455,
	// 	height:455,
	// 	icon: terminal,
	// },{
		name: "ZTMLog",
		label: "ZTM Log",
		url:'/#/app/term',
		width:455,
		height:600,
		icon: ztmlog,
	},{
		name: "EPLog",
		label: "EP Log",
		url:'/#/mesh/log',
		width:455,
		height:600,
		icon: eplog,
	},{
		name: "browser",
	}];
const mobileApp = [{
		name: "setting",
	},{
		name: "ZTMLog",
		label: "ZTM Log",
		url:'/#/app/term',
		width:455,
		height:600,
		icon: ztmlog,
	},{
		name: "browser",
	}];
const webApp = [{
		name: "setting",
	},{
		name: "ZTMLog",
		label: "ZTM Log",
		url:'/#/app/term',
		width:455,
		height:600,
		icon: ztmlog,
	},{
		name: "browser",
	}]
const appSelect = {
	web:webApp,
	ios:mobileApp,
	android:mobileApp,
}
const apps = !!window.__TAURI_INTERNALS__ ? (appSelect[platform()] || defaultApp) : mobileApp;
const appMapping = {
	"/setting": {
		icon: setting,
		name: "Setting",
		component: SettingComponent
	},
	"/browser": {
		icon: browser,
		name: "Browser",
		component: BrowserComponent
	},
	"ztm/script": {
		icon: scriptIcon,
		name: "Scripts",
		width:1280,
		height:860,
	},
	"ztm/proxy": {
		icon: proxy,
		name: "Proxy",
		width:1280,
		height:860,
	},
	"ztm/terminal": {
		icon: terminal,
		name: "Terminal",
		width:455,
		height:350,
	},
	"ztm/tunnel": {
		icon: tunnel,
		name: "Tunnel",
		width:1280,
		height:860,
	},
}
export {
	apps, appMapping
};