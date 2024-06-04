<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { removeAuthorization, AUTH_TYPE } from "@/service/common/request";
import { useLayout } from '@/layout/composables/layout';
import { useRouter, useRoute } from 'vue-router';
import { getMenu } from './menu';
import XeyeSvg from "@/assets/img/web-logo.png";
import MeshSelector from '@/views/mesh/common/MeshSelector.vue'
import HoverXeyeSvg from "@/assets/img/hover-web-logo.png";
import { useStore } from 'vuex';
import { isAdmin } from "@/service/common/authority-utils";
import { useConfirm } from "primevue/useconfirm";

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

const load = (d) => {
	store.commit('account/setMeshes', d);
}

const select = (selected) => {
	store.commit('account/setSelectedMesh', selected);
}
</script>

<template>
	<Menubar class="app-bottom-bar mobile-show" :model="model" breakpoint="0px">
			<template #item="{ item, props, hasSubmenu, root }">
					<router-link v-if="item.route && !item.cond" v-slot="{ href, navigate }" :to="item.route" custom>
							<a class="flex flex-column" :class="{'actived':focusMenu == item.route}" v-ripple :href="href" v-bind="props.action"  @click="() => { focusMenu = item.route;return navigate}">
									<Badge v-if="item.label == 'Message'" value="2" severity="danger" class="absolute" style="margin-left: 24px;top:3px"/>
									<div class="menu-icon" :class="item.icon" />
									<div class="text-sm" >{{ item.short }}</div>
							</a>
					</router-link>
			</template>
	</Menubar>
</template>

<style scoped lang="scss">
:deep(.p-select-dropdown) {
  display: none;
}
</style>
