<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { removeAuthorization, AUTH_TYPE } from "@/service/common/request";
import { useLayout } from '@/layout/composables/layout';
import { useRouter, useRoute } from 'vue-router';
import { getMenu } from './menu';
import XeyeSvg from "@/assets/img/web-logo.png";
import HoverXeyeSvg from "@/assets/img/hover-web-logo.png";
import { useStore } from 'vuex';
import { isAdmin } from "@/service/common/authority-utils";
import { useConfirm } from "primevue/useconfirm";
import { useI18n } from 'vue-i18n';
import { openWebview } from '@/utils/webview';
const { t } = useI18n();
const selectedMesh = computed(() => {
	return store.getters["account/selectedMesh"]
});
const store = useStore();
const confirm = useConfirm();
const model = computed(() => {
	return getMenu(true)
});
const { layoutConfig, onMenuToggle } = useLayout();

const outsideClickListener = ref(null);
const topbarMenuActive = ref(false);
const router = useRouter();
const route = useRoute();

onMounted(() => {
    bindOutsideClickListener();
});

onBeforeUnmount(() => {
    unbindOutsideClickListener();
});

const username = computed(() => {
	const agent = selectedMesh.value?.agent;
	if(!!agent?.name && !!agent?.username){
		return `${agent.name} | ${agent.username}`;
	} else {
		return agent?.name || agent?.username;
	}
})
const onTopBarMenuButton = () => {
    topbarMenuActive.value = !topbarMenuActive.value;
};
const topbarMenuClasses = computed(() => {
    return {
        'layout-topbar-menu-mobile-active': topbarMenuActive.value
    };
});

const bindOutsideClickListener = () => {
    if (!outsideClickListener.value) {
        outsideClickListener.value = (event) => {
            if (isOutsideClicked(event)) {
                topbarMenuActive.value = false;
            }
        };
        document.addEventListener('click', outsideClickListener.value);
    }
};
const unbindOutsideClickListener = () => {
    if (outsideClickListener.value) {
        document.removeEventListener('click', outsideClickListener);
        outsideClickListener.value = null;
    }
};
const isOutsideClicked = (event) => {
    if (!topbarMenuActive.value) return;

    const sidebarEl = document.querySelector('.layout-topbar-menu');
    const topbarEl = document.querySelector('.layout-topbar-menu-button');

    return !(sidebarEl.isSameNode(event.target) || sidebarEl.contains(event.target) || topbarEl.isSameNode(event.target) || topbarEl.contains(event.target));
};
//====
const logout = () => {
    confirm.require({
        message: 'Are you sure you want to exit?',
        header: 'Logout',
        icon: 'pi pi-exclamation-triangle',
        accept: () => {
					removeAuthorization(AUTH_TYPE.BASIC);
					store.commit('account/setUser', null);
          router.push('/login');
        },
        reject: () => {
            
        }
    });
};
const logoHover = ref(false);

const menu = ref();

const toggle = (event) => {
    menu.value.toggle(event);
};
const home = () => {
	router.push('/root');
}
const items = ref([
    {
				label: "Options",
        items: [
            {
                label: 'Logout',
                icon: 'pi pi-power-off',
								command: () => {
									logout();
								}
            },
            {
                label: 'Collapse',
                icon: 'pi pi-window-minimize',
								command: () => {
									home();
								}
            }
        ]
    }
]);
const menuClick = (e) => {
	console.log(e)
}
const hasTauri = ref(!!window.__TAURI_INTERNALS__);
const focusMenu = ref(route.path);

const unread = computed(() => {
	return store.getters["notice/unread"];
});
const select = (selected) => {
	store.commit('account/setSelectedMesh', selected);
}

const goApp = (item) => {
	const webviewOptions = {
		url: item.app,
		name: item.label,
		width:item?.width || 1280,
		height:item?.height || 860,
		proxy:''
	}
	console.log(webviewOptions)
	openWebview(webviewOptions);
	focusMenu.value = item.app;
}
</script>

<template>
	<Menubar class="app-bottom-bar mobile-show" :model="model" breakpoint="0px">
			<template #item="{ item, props, hasSubmenu, root }">
					<router-link v-if="item.route && !item.cond" v-slot="{ href, navigate }" :to="item.route" custom>
							<a class="flex flex-column" :class="{'actived':focusMenu == item.route}" v-ripple :href="href" v-bind="props.action"  @click="() => { focusMenu = item.route;return navigate}">
									<Badge v-if="item.label == 'Chat' && unread>0" :value="unread" severity="danger" class="absolute" style="margin-left: 24px;top:3px"/>
									<svg v-if="item.svg" class="svg w-2rem h-2rem" aria-hidden="true">
										<use :xlink:href="item.svg"></use>
									</svg>
									<div v-else class="menu-icon" :class="item.icon" />
									<div class="text-sm" >{{ t(item.short) }}</div>
							</a>
					</router-link>
					<a :class="{'actived':focusMenu == item.app}" class="flex flex-column" v-else-if="!!item.app" v-ripple href="javascript:void(0)" @click="goApp(item)" v-bind="props.action">
							<svg v-if="item.svg" class="svg w-2rem h-2rem" aria-hidden="true">
								<use :xlink:href="item.svg"></use>
							</svg>
							<div v-else class="menu-icon" :class="item.icon" />
							<div class="text-sm">{{ t(item.label) }} </div>
							<!-- <span v-if="hasSubmenu" class="pi pi-fw pi-angle-right ml-2 relative" style="top: 2px;" /> -->
					</a>
			</template>
	</Menubar>
</template>

<style scoped lang="scss">
:deep(.p-select-dropdown) {
  display: none;
}
</style>
