
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
	chat: [
		{
				label: 'Channels',short:'Channel', icon: 'pi pi-fw pi-globe', route: '/mesh/list'
		},
		{
				label: 'Message',short:'Msg', icon: 'pi pi-comment', route: '/message/list'
		},
		{
				label: 'Contacts',short:'Contact', icon: 'pi pi-fw pi-users', route: '/mesh/endpoints'
		},
		{
				label: 'Workplace',short:'More', icon: 'pi pi-fw pi-objects-column', route: '/workplace'
		},
	]
};

export function getMenu(){
	const isChat = import.meta.env.VITE_APP_MODE == 'chat';
	const menu = prodMenu[isChat?'chat':'base'];
	return menu;
}
