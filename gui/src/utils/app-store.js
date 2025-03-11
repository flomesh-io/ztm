import browser from "@/assets/img/apps/browser.png";
import proxy from "@/assets/img/apps/proxy.png";
import rdp from "@/assets/img/apps/rdp.png";
import terminal from "@/assets/img/apps/terminal.png";
import scriptIcon from "@/assets/img/apps/script.png";
import chatIcon from "@/assets/img/apps/chat.png";
import usersIcon from "@/assets/img/apps/users.png";
import tunnel from "@/assets/img/apps/tunnel.png";
import setting from "@/assets/img/apps/setting.png";
import consoleIcon from "@/assets/img/apps/console.png";
import cloudIcon from "@/assets/img/apps/cloud.png";
import ztmlog from "@/assets/img/apps/ztmlog.png";
import eplog from "@/assets/img/apps/eplog.png";
import BrowserComponent from '@/views/apps/core/Browser.vue';
import SettingComponent from '@/views/apps/core/Setting.vue';
import RDPComponent from '@/views/apps/core/RDP.vue';
import ChatComponent from '@/views/chat/Main.vue';
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
		url:'/#/app/ztmlog',
		width:455,
		height:600,
		icon: ztmlog,
	},{
		name: "EPLog",
		label: "EP Log",
		url:'/#/mesh/log',
		width:1280,
		height:860,
		icon: eplog,
	},{
		name: "browser",
	},{
		name: "rdp",
	}];
const mobileApp = [{
		name: "setting",
	},{
		name: "ZTMLog",
		label: "ZTM Log",
		url:'/#/app/ztmlog',
		width:455,
		height:600,
		icon: ztmlog,
	},{
		name: "browser",
	},{
		name: "rdp",
	}];
const webApp = [{
		name: "ZTMLog",
		label: "ZTM Log",
		url:'/#/app/ztmlog',
		width:455,
		height:600,
		icon: ztmlog,
	},{
		name: "rdp",
	}];
const appSelect = {
	web:webApp,
	ios:mobileApp,
	android:mobileApp,
}
const apps = !!window.__TAURI_INTERNALS__ ? (appSelect[platform()] || defaultApp) : webApp;
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
	"/rdp": {
		icon: rdp,
		name: "RDP",
		component: RDPComponent
	},
	"ztm/users": {
		icon: usersIcon,
		url:'/#/mesh/endpoints',
		name: "Users",
		width:1280,
		height:860,
	},
	"ztm/chat": {
		icon: chatIcon,
		url:'/#/chat/rooms',
		component: ChatComponent,
		name: "Chat",
		width:330,
		height:860,
	},
	"ztm/script": {
		icon: scriptIcon,
		name: "Scripts",
		width:1280,
		height:860,
	},
	"ztm/cloud": {
		icon: cloudIcon,
		name: "Cloud",
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