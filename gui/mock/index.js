export default [
	{
		type: "post",
		url: "/client/api/login",
		response: () => {
			return {
				token: "XXXXXXX"
			}
		}
	},
	{
		type: "post",
		url: "/server/api/login",
		response: () => {
			return {
				token: "XXXXXXX"
			}
		}
	},
	{
		type: "post",
		url: "/api/login",
		response: () => {
			return {
				token: "XXXXXXX"
			}
		}
	},
	{
		type: "post",
		url: "/client/api",
		response: () => {
			return []
		}
	},
	{
		type: "get",
		url: "/api/meshes",
		response: () => {
			return [
				{ label: 'Dalian Hub', value: 'Dalian' },
				{ label: 'Beijing Hub', value: 'Beijing' },
				{ label: 'Shanghai Hub', value: 'Shanghai' },
			]
		}
	},
]