<script setup>
import { computed, watch, ref, onMounted } from 'vue';
import { useLayout } from '@/layout/composables/layout';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { platform } from '@/utils/platform';

const store = useStore();
const router = useRouter();
const { layoutConfig, layoutState } = useLayout();
const outsideClickListener = ref(null);
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
				'transform-layout':false
    };
		if(!!platform()){
			classAry[platform()] = true;
		}
		return classAry;
});

</script>

<template>
		<div class="layout-wrapper embed-wrapper" :class="containerClass" >
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
        </div>
        <div class="layout-mask"></div>
    </div>
</template>
