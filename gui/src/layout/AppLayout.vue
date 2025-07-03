<script setup>
import { computed, watch, ref, onMounted } from 'vue';
import AppRoot from './AppRoot.vue';
import AppTopbar from './AppTopbar.vue';
import AppBottombar from './AppBottombar.vue';
import AppFooter from './AppFooter.vue';
import AppSidebar from './AppSidebar.vue';
import { useLayout } from '@/layout/composables/layout';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { isMobileWidth } from '@/utils/platform';
// import { listen } from '@tauri-apps/api/event';
// import { getCurrentWindow } from '@tauri-apps/api/window';

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

const app = computed(() => {
	return store.getters['notice/app'];
});
const hasTauri = ref(!!window.__TAURI_INTERNALS__);
const home = () => {
	router.push('/root');
}
const isMobile = computed(isMobileWidth);

const toggleLeft = () => {
	store.commit('account/setMobileLeftbar', false);
}
const windowHeight = ref(window.innerHeight);
const viewHeight = computed(() => windowHeight.value);
const platform = computed(() => {
	return store.getters['account/platform']
});
const isMobileTauri = computed(()=>{
	return platform.value == 'ios' || platform.value == 'android';
})
const mobileLeftbar = computed(() => {
	return (platform.value == 'ios' || platform.value == 'android')?store.getters['account/mobileLeftbar']:false;
});

const containerClass = computed(() => {
     let classAry = {
        'layout-theme-light': layoutConfig.darkTheme.value === 'light',
        'layout-theme-dark': layoutConfig.darkTheme.value === 'dark',
        'layout-overlay': layoutConfig.menuMode.value === 'overlay',
        'layout-static': layoutConfig.menuMode.value === 'static',
        'layout-static-inactive': layoutState.staticMenuDesktopInactive.value && layoutConfig.menuMode.value === 'static',
        'layout-overlay-active': layoutState.overlayMenuActive.value,
        'layout-mobile-active': layoutState.staticMenuMobileActive.value,
        'p-input-filled': layoutConfig.inputStyle.value === 'filled',
        'p-ripple-disabled': !layoutConfig.ripple.value,
				'transform-layout':!!mobileLeftbar.value
    };
		if(!!platform.value){
			classAry[platform.value] = true;
		}
		return classAry;
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

onMounted(()=>{
	// getCurrentWindow().listen<string>('tauri-back', (event) => {
	// 	store.commit('notice/setApp', null);
	// });
	if(platform.value == 'ios'){
		setTimeout(()=>{
			fetch('https://flomesh.io/').then(()=>{})
		},300)
	}
})
</script>

<template>
		<div class="embed-root" :class="mobileLeftbar?'show':''" v-if="isMobileTauri">
			<AppRoot :embed="true"/>
		</div>
		<div class="layout-wrapper main-wrapper" :class="containerClass" @click="toggleLeft">
        <app-topbar></app-topbar>
<!--        <div class="layout-sidebar">
            <app-sidebar></app-sidebar>
        </div> -->
        <div class="layout-main-container"  >
            <div class="layout-main" >
							<iframe v-if="app && !!app.url" :src="app.url" width="100%" frameborder="0" :height="viewHeight"/>
							<router-view
								v-else
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
							<app-bottombar></app-bottombar>
            </div>
            <!-- <app-footer></app-footer> -->
        </div>
				<app-config></app-config>
				<div class="layout-mask"></div>
    </div>
</template>

<style lang="scss" scoped>
	.backHomeBtn{
		position: fixed !important;
		right: 15px;
		bottom: 15px;
		box-shadow:0 0 12px 12px rgba(0, 0, 0, 0.05);
	}
</style>
