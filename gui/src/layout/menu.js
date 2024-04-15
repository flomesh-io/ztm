const menu = [
	{
			label: 'Meshes', icon: 'pi pi-fw pi-globe', route: '/mesh/list'
	},
	{
			label: 'Services', icon: 'pi pi-fw pi-server', route: '/mesh/services'
	},
	{
			label: 'Endpoints', icon: 'pi pi-fw pi-chart-scatter', route: '/mesh/endpoints'
	},
	{
			label: 'Local Ports', icon: 'pi pi-fw pi-bullseye', route: '/mesh/ports'
	},
]

const prodMenu = {
	client: menu,
	server: menu
};

		
const devMenu = [
		{
		    label: 'Pages',
		    icon: 'pi pi-fw pi-briefcase',
		    items: [
						{ label: 'Dashboard', icon: 'pi pi-fw pi-home', route: '/page/dashboard' },
		        {
		            label: 'Landing',
		            icon: 'pi pi-fw pi-globe',
		            route: '/landing'
		        },
		        {
		            label: 'Backends',
		            icon: 'pi pi-fw pi-sitemap',
		            route: '/page/backends'
		        },
		        {
		            label: 'Auth',
		            icon: 'pi pi-fw pi-user',
		            items: [
		                {
		                    label: 'Login',
		                    icon: 'pi pi-fw pi-sign-in',
		                    route: '/login'
		                },
		                {
		                    label: 'Error',
		                    icon: 'pi pi-fw pi-times-circle',
		                    route: '/error'
		                },
		                {
		                    label: 'Access Denied',
		                    icon: 'pi pi-fw pi-lock',
		                    route: '/403'
		                }
		            ]
		        },
		        {
		            label: 'Crud',
		            icon: 'pi pi-fw pi-pencil',
		            route: '/page/crud'
		        },
		        {
		            label: 'Timeline',
		            icon: 'pi pi-fw pi-calendar',
		            route: '/page/timeline'
		        },
		        {
		            label: 'Not Found',
		            icon: 'pi pi-fw pi-exclamation-circle',
		            route: '/404'
		        },
		        {
		            label: 'Empty',
		            icon: 'pi pi-fw pi-circle-off',
		            route: '/page/empty'
		        },
						{
								label: 'Config', icon: 'pi pi-fw pi-cog', route: '/client/config'
						},
						{
								label: 'Doc',
								icon: 'pi pi-fw pi-question',
								route: '/client/documentation'
						},
						{
								label: 'Network', icon: 'pi pi-fw pi-globe', route: '/server/network', cond: 'client'
						},
						
						{
								label: 'Test Tool', icon: 'pi pi-fw pi-wifi', route: '/server/testtool', cond: 'client'
						},
						{
								label: 'Clients', icon: 'pi pi-fw pi-desktop', route: '/server/clients', shortcut: '⌘+N'
						},
						{
								label: 'Backends', icon: 'pi pi-fw pi-sitemap', route: '/server/backends'
						},
						{
								label: 'Database', icon: 'pi pi-fw pi-database', route: '/server/database', shortcut: '⌘+N'
						},
		    ]
		},
    {
        label: 'UI Components',
        items: [
            { label: 'Form Layout', icon: 'pi pi-fw pi-id-card', route: '/uikit/formlayout' },
            { label: 'Input', icon: 'pi pi-fw pi-check-square', route: '/uikit/input' },
            { label: 'Float Label', icon: 'pi pi-fw pi-bookmark', route: '/uikit/floatlabel' },
            { label: 'Invalid State', icon: 'pi pi-fw pi-exclamation-circle', route: '/uikit/invalidstate' },
            { label: 'Button', icon: 'pi pi-fw pi-mobile', route: '/uikit/button', class: 'rotated-icon' },
            { label: 'Table', icon: 'pi pi-fw pi-table', route: '/uikit/table' },
            { label: 'List', icon: 'pi pi-fw pi-list', route: '/uikit/list' },
            { label: 'Tree', icon: 'pi pi-fw pi-share-alt', route: '/uikit/tree' },
            { label: 'Panel', icon: 'pi pi-fw pi-tablet', route: '/uikit/panel' },
            { label: 'Overlay', icon: 'pi pi-fw pi-clone', route: '/uikit/overlay' },
            { label: 'Media', icon: 'pi pi-fw pi-image', route: '/uikit/media' },
            { label: 'Menu', icon: 'pi pi-fw pi-bars', route: '/uikit/menu', preventExact: true },
            { label: 'Message', icon: 'pi pi-fw pi-comment', route: '/uikit/message' },
            { label: 'File', icon: 'pi pi-fw pi-file', route: '/uikit/file' },
            { label: 'Chart', icon: 'pi pi-fw pi-chart-bar', route: '/uikit/charts' },
            { label: 'Misc', icon: 'pi pi-fw pi-circle', route: '/uikit/misc' }
        ]
    },
    {
        label: 'Prime Blocks',
        items: [
            { label: 'Free Blocks', icon: 'pi pi-fw pi-eye', route: '/page/blocks', badge: 'NEW' },
            { label: 'All Blocks', icon: 'pi pi-fw pi-globe', url: 'https://www.primefaces.org/primeblocks-vue', target: '_blank' }
        ]
    },
    {
        label: 'Utilities',
        items: [
            { label: 'PrimeIcons', icon: 'pi pi-fw pi-prime', route: '/page/icons' },
            { label: 'PrimeFlex', icon: 'pi pi-fw pi-desktop', url: 'https://www.primefaces.org/primeflex/', target: '_blank' }
        ]
    }
]

export function getMenu(isAdmin){
	const menu = prodMenu[isAdmin?'server':'client'];
	return process.env.NODE_ENV === "development"?[
		...menu,
		...devMenu
	]:menu;
}
