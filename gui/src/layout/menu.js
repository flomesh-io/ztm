import { platform } from '@tauri-apps/plugin-os';
const menus = {
	tauri: [
		{
				label: 'Meshes',short:'Mesh', svg: '#svg-mesh', route: '/mesh/list'
		},
		{
				label: 'Endpoints',short:'EP', svg: '#svg-endpoint', route: '/mesh/endpoints'
		},
		{
				label: 'Chat',short:'Chat', svg: '#svg-log', route: '/mesh/chat'
		},
		{
				label: 'Cloud',short:'Cloud', svg: '#svg-cloud', app: '/api/meshes/Local/apps/ztm/cloud/'
		},
		// {
		// 		label: 'Logs',short:'Log', svg: '#svg-log', route: '/mesh/log'
		// },
	],
	web: [
		{
				label: 'Meshes',short:'Mesh', svg: '#svg-mesh', route: '/mesh/list'
		},
		{
				label: 'Endpoints',short:'EP', svg: '#svg-endpoint', route: '/mesh/endpoints'
		},
		{
				label: 'Chat',short:'Chat', svg: '#svg-chat', route: '/mesh/chat'
		},
		{
				label: 'Cloud',short:'Cloud', svg: '#svg-cloud', app: '/api/meshes/Local/apps/ztm/cloud/'
		},
		{
				label: 'Apps',short:'Apps', svg: '#svg-grid', route: '/mesh/apps'
		},
		// {
		// 		label: 'Logs',short:'Log', svg: '#svg-log', route: '/mesh/log'
		// },
	],
};

export function getMenu(){
	return menus[!!window.__TAURI_INTERNALS__ && platform() != "android" && platform() != "ios" ?'tauri':'web'];
}
