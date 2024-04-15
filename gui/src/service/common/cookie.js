import Cookie from "js-cookie";
const hasCookie = false;
function set(key, value, option){
	const _option = option || {};
	if(hasCookie){
		Cookie.set(key, value, {
			..._option,
		});
	} else {
		localStorage.setItem(key, value);
	}
}
function get(key){
	if(hasCookie){
		return Cookie.get(key);
	} else {
		return localStorage.getItem(key);
	}
}
function remove(key){
	if(hasCookie){
		Cookie.remove(key);
	} else {
		localStorage.removeItem(key);
	}
}
export default{
  set,
  get,
	remove
};
