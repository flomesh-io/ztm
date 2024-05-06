const rules = {
	name: {
		required: true,
		customAsync: true,
		// custom: (value) => {
		// 	if(false) {
		// 		return true;
		// 	}
		// 	return 'The text cannot be "test';
		// },
	},
	uniqueName: (params) => {
		return {
			required: true,
			min:1,
			uniqueName: [params]
		}
	},
	required: "required",
}
//required|min:6|custom:customRule
export default rules;