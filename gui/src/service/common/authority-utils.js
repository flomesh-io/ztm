import _ from "lodash";
import store from "@/store";

function isServer(){
	return false;
}

function isAdmin(){
	const user = store.getters["account/user"];
	return user?.id == 'admin';
}

function hasRole(authority, role) {
  return hasAnyRole(authority, role);
}

function hasAnyRole(required, role) {
  if (
    !required ||
    required.permission === "*" ||
    (role && role.type == "authenticated")
  ) {
    return true;
  } else if (
    required.permission === "admin" &&
    role &&
    role.type == "authenticated"
  ) {
    return true;
  } else if (role && role.permissions){
    let hasPermission = false;
    role.permissions.forEach((permission) => {
      permission.actions.forEach((action) => {
        let permissionRoles = Array.isArray(required.permission)
          ? required.permission
          : [required.permission];
        const isIncludeA = permissionRoles.includes(
          `${permission.name}:${action.name}`,
        );
        const isIncludeB =
          permission.type == "project" && permission.project.id
            ? permissionRoles.includes(
                `${permission.name}:${action.name}:project:${permission.project.id}`,
              )
            : false;
        const isIncludeC =
          permission.type == "organization" && permission.organization.id
            ? permissionRoles.includes(
                `${permission.name}:${action.name}:organization:${permission.organization.id}`,
              )
            : false;
        if (action.enabled && (isIncludeA || isIncludeB || isIncludeC)) {
          hasPermission = true;
        }
      });
    });
    return hasPermission;
  } else {
		return false;
	}
}

function hasAuthority(route, permissions, role) {
  const authorities = [
    ...(route.meta.pAuthorities || []),
    route.meta.authority || "",
  ];
  for (let authority of authorities) {
    if (!hasRole(authority, role)) {
      return false;
    }
  }
  return true;
}

function filterMenu(menuData, permissions, role) {
  if (menuData) {
    return _.cloneDeep(menuData).filter((menu) => {
      if (menu.meta && !menu.meta.invisible) {
        if (!hasAuthority(menu, permissions, role)) {
          return false;
        }
      }
      if (menu.children && menu.children.length > 0) {
        menu.children = filterMenu(menu.children, permissions, role);
      }
      return true;
    });
  } else {
    return [];
  }
}

export { isServer, filterMenu, hasAuthority, isAdmin };
