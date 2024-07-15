
const menus = {
	tauri: [
		{
				label: 'Meshes',short:'Mesh', icon: 'pi pi-fw pi-globe', route: '/mesh/list'
		},
		{
				label: 'Endpoints',short:'EP', icon: 'pi pi-fw pi-chart-scatter', route: '/mesh/endpoints'
		},
		{
				label: 'Logs',short:'Log', icon: 'pi pi-fw pi-book', route: '/mesh/log'
		},
	],
	web: [
		{
				label: 'Meshes',short:'Mesh', icon: 'pi pi-fw pi-globe', route: '/mesh/list'
		},
		{
				label: 'Endpoints',short:'EP', icon: 'pi pi-fw pi-chart-scatter', route: '/mesh/endpoints'
		},
		{
				label: 'Apps',short:'Apps', icon: 'pi pi-fw pi-objects-column', route: '/mesh/apps'
		},
		{
				label: 'Logs',short:'Log', icon: 'pi pi-fw pi-book', route: '/mesh/log'
		},
	],
};

export function getMenu(){
	return menus[!!window.__TAURI_INTERNALS__?'tauri':'web'];
}
