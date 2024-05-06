import { configure, defineRule } from 'vee-validate';
import * as rules from '@vee-validate/rules';

Object.keys(rules).forEach(rule => {
  defineRule(rule, rules[rule]);
});
defineRule('custom', (value, [target], ctx) => {
  if (value != 'test') {
    return true;
  }
  return 'Passwords must match';
});

defineRule('customAsync', async (value, [target], ctx) => {
  return new Promise((resolve) => {
  	setTimeout(() => {
  		const isValid = value !== 'test';
  		resolve(isValid?true:'customAsync must match');
  	}, 1000);
  });
});
defineRule('uniqueName', async (value, [target], ctx) => {
  return uniqueValidate({
		n:'name',
		value,
		mode: target?.T,
		_where: target
	});
});
const uniqueValidate = ({
	n, mode, _where, value
})=>{
	if(!value || !mode){
		return Promise.resolve(true);
	}else{
		delete _where.T;
		let filters = ``;
		filters += `${n}: { eq:"${value}" }`;
		if(_where){
			Object.keys(_where).forEach((_key)=>{
				if(_key == "id"){
					if(!!_where[_key]){
						filters += `, id: { ne:${_where[_key]} }`;
					}
				}else if(_where[_key] == null){
					filters += `, ${_key}: { id:{null:true} }`;
				}else if(!isNaN(_where[_key]*1)){
					if(_where[_key]!=""){
						filters += `, ${_key}: { id:{eq:"${_where[_key]}"} }`;
					}
				}else{
					filters += `, ${_key}: { eq:"${_where[_key]}" }`;
				}
			});
		}
		return new Promise((resolve, reject) => {
			return resolve(true)
			// query(`${mode}(filters: {${filters}}, pagination:{start: 0, limit: 1}){
			// 	data{id}
			// }`)
			// .then((res) => {
			// 	if(res.data && res.data.length>0){
			// 		return resolve('The name already exists');
			// 	}else{
			// 		return resolve(true);
			// 	}
			// });
		});
	}
}
export default {}