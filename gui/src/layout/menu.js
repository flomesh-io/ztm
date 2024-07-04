
const prodMenu = {
	base: [
		{
				label: 'Meshes',short:'Mesh', icon: 'pi pi-fw pi-globe', route: '/mesh/list'
		},
		{
				label: 'Services',short:'SVC', icon: 'pi pi-fw pi-server', route: '/mesh/services'
		},
		{
				label: 'Endpoints',short:'EP', icon: 'pi pi-fw pi-chart-scatter', route: '/mesh/endpoints'
		},
		{
				label: 'Local Port',short:'Port', icon: 'pi pi-fw pi-bullseye', route: '/mesh/ports'
		},
		{
				label: 'Logs',short:'Log', icon: 'pi pi-fw pi-book', route: '/mesh/log'
		},
	],
};

export function getMenu(){
	return [
		{
				label: 'Meshes',short:'Mesh', icon: 'pi pi-fw pi-globe', route: '/mesh/list'
		},
		{
				label: 'Endpoints',short:'EP', icon: 'pi pi-fw pi-chart-scatter', route: '/mesh/endpoints'
		},
		{
				label: 'App Store',short:'App Store', icon: 'pi pi-fw pi-objects-column', route: '/store/apps'
		},
		{
				label: 'Logs',short:'Log', icon: 'pi pi-fw pi-book', route: '/mesh/log'
		},
	];
}
