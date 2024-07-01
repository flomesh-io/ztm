<script setup>
import { computed, watch, ref, onMounted } from 'vue';
import AppTopbar from './AppTopbar.vue';
import AppBottombar from './AppBottombar.vue';
import { useLayout } from '@/layout/composables/layout';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';

const store = useStore();
const router = useRouter();
const { layoutConfig, layoutState, isSidebarActive } = useLayout();
const outsideClickListener = ref(null);

watch(isSidebarActive, (newVal) => {
    if (newVal) {
        bindOutsideClickListener();
    } else {
        unbindOutsideClickListener();
    }
});

const mobileLeftbar = computed(() => {
	return store.getters['account/mobileLeftbar'];
});
const containerClass = computed(() => {
    return {
        'layout-theme-light': layoutConfig.darkTheme.value === 'light',
        'layout-theme-dark': layoutConfig.darkTheme.value === 'dark',
        'layout-overlay': layoutConfig.menuMode.value === 'overlay',
        'layout-static': layoutConfig.menuMode.value === 'static',
        'layout-static-inactive': layoutState.staticMenuDesktopInactive.value && layoutConfig.menuMode.value === 'static',
        'layout-overlay-active': layoutState.overlayMenuActive.value,
        'layout-mobile-active': layoutState.staticMenuMobileActive.value,
        'p-input-filled': layoutConfig.inputStyle.value === 'filled',
        'p-ripple-disabled': !layoutConfig.ripple.value,
				'mobile-transform-layout':!!mobileLeftbar.value
    };
});
const bindOutsideClickListener = () => {
    if (!outsideClickListener.value) {
        outsideClickListener.value = (event) => {
            if (isOutsideClicked(event)) {
                layoutState.overlayMenuActive.value = false;
                layoutState.staticMenuMobileActive.value = false;
                layoutState.menuHoverActive.value = false;
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
    const sidebarEl = document.querySelector('.layout-sidebar');
    const topbarEl = document.querySelector('.layout-menu-button');

    return !(sidebarEl.isSameNode(event.target) || sidebarEl.contains(event.target) || topbarEl.isSameNode(event.target) || topbarEl.contains(event.target));
};

const home = () => {
	router.push('/root');
}
const windowWidth = computed(() => window.innerWidth);
const isMobile = computed(() => windowWidth.value<=768);

const toggleLeft = () => {
	store.commit('account/setMobileLeftbar', false);
}
</script>

<template>
		<div class="layout-wrapper" :class="containerClass" @click="toggleLeft">
        <app-topbar></app-topbar>
        <div class="layout-main-container"  >
            <div class="layout-main" >
							
							<router-view
							  v-slot="{ Component }"
							>
							  <keep-alive>
							    <component
							      :is="Component"
							      :key="$route.fullPath"
							      ref="tabContent"
							    />
							  </keep-alive>
							</router-view>
            </div>
						<app-bottombar></app-bottombar>
        </div>
        <div class="layout-mask"></div>
    </div>
</template>
