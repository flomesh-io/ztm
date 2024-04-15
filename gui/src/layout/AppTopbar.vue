<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { removeAuthorization, AUTH_TYPE } from "@/service/common/request";
import { useLayout } from '@/layout/composables/layout';
import { useRouter, useRoute } from 'vue-router';
import { getMenu } from './menu';
import XeyeSvg from "@/assets/img/lg-white.svg";
import HoverXeyeSvg from "@/assets/img/white.svg";
import store from "@/store";
import { isAdmin } from "@/service/common/authority-utils";
import { useConfirm } from "primevue/useconfirm";
const confirm = useConfirm();
const model = computed(() => {
	return getMenu(isAdmin())
});
const desktopPath = computed(() => {
	return isAdmin()?'/server/clients':'/client/hostinfo'
});
const clientPath = computed(() => {
	return store.getters["account/client"]?('/'+store.getters["account/client"]):null
});

const emits = defineEmits(['collapse']);

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

const logoUrl = computed(() => {
    return `layout/images/${layoutConfig.darkTheme.value ? 'logo-white' : 'logo-dark'}.svg`;
});

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
</script>

<template>
	<Menubar class="app-top-bar" :model="model">
			<template #start>
				<img class="logo" style="cursor: pointer;" @mouseleave="logoHover = false" @mouseover="logoHover = true" :src="logoHover?HoverXeyeSvg:XeyeSvg" height="40"/>
			</template>
			<template #item="{ item, props, hasSubmenu, root }">
					<router-link v-if="item.route && !!clientPath && item.cond == 'client'" v-slot="{ href, navigate }" :to="item.route+clientPath" custom>
							<a :class="{'actived':focusMenu == item.route}" v-ripple :href="href" v-bind="props.action" @click="() => { focusMenu = item.route;return navigate}">
									<span :class="item.icon" />
									<span class="ml-2">{{ item.label }}</span>
							</a>
					</router-link>
					<router-link v-else-if="item.route && !item.cond" v-slot="{ href, navigate }" :to="item.route" custom>
							<a :class="{'actived':focusMenu == item.route}" v-ripple :href="href" v-bind="props.action"  @click="() => { focusMenu = item.route;return navigate}">
									<span :class="item.icon" />
									<span class="ml-2">{{ item.label }}</span>
							</a>
					</router-link>
					<a v-else-if="!item.route" v-ripple :href="item.url" :target="item.target" v-bind="props.action">
							<span :class="item.icon" />
							<span class="ml-2">{{ item.label }}</span>
							<span v-if="hasSubmenu" class="pi pi-fw pi-angle-down ml-2" />
					</a>
			</template>
			<template #end v-if="hasTauri">
					<div class="flex align-items-center ">
						<Button size="large" class="right-icon" type="button" icon="pi pi-window-minimize" @click="home" aria-haspopup="true" aria-controls="overlay_menu" />
						<!-- <Menu ref="menu" id="overlay_menu" :model="items" :popup="true" @click="menuClick"/> -->
					</div>
					
			</template>
	</Menubar>
	<ConfirmDialog></ConfirmDialog>
    <!-- <div class="layout-topbar">
        <router-link to="/" class="layout-topbar-logo">
            <img :src="logoUrl" alt="logo" />
            <span>SAKAI</span>
        </router-link>

        <button class="p-link layout-menu-button layout-topbar-button" @click="onMenuToggle()">
            <i class="pi pi-bars"></i>
        </button>

        <button class="p-link layout-topbar-menu-button layout-topbar-button" @click="onTopBarMenuButton()">
            <i class="pi pi-ellipsis-v"></i>
        </button>

        <div class="layout-topbar-menu" :class="topbarMenuClasses">
            <button @click="onTopBarMenuButton()" class="p-link layout-topbar-button">
                <i class="pi pi-calendar"></i>
                <span>Calendar</span>
            </button>
            <button @click="onTopBarMenuButton()" class="p-link layout-topbar-button">
                <i class="pi pi-user"></i>
                <span>Profile</span>
            </button>
            <button @click="onSettingsClick()" class="p-link layout-topbar-button">
                <i class="pi pi-cog"></i>
                <span>Settings</span>
            </button>
        </div>
    </div> -->
</template>

<style lang="scss" scoped></style>
