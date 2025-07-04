<script setup>
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue';
import { removeAuthorization, AUTH_TYPE } from "@/service/common/request";
import { useLayout } from '@/layout/composables/layout';
import { useRouter, useRoute } from 'vue-router';
import { getMenu } from './menu';
import XeyeSvg from "@/assets/img/white.png";
import { useStore } from 'vuex';
import { isAdmin } from "@/service/common/authority-utils";
import { useConfirm } from "primevue/useconfirm";
import { copy } from '@/utils/clipboard';
import { downloadFile } from '@/utils/file';
import toast from "@/utils/toast";
import ZtmService from '@/service/ZtmService';
import { openWebview } from '@/utils/webview';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
const ztmService = new ZtmService();
const selectedMesh = computed(() => {
	return store.getters["account/selectedMesh"]
});

const user = computed(() => {
	return store.getters['account/user'];
});
const store = useStore();
const confirm = useConfirm();
const model = computed(() => {
	return getMenu(false)
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

const load = (d) => {}

const select = (selected) => {
	store.commit('account/setSelectedMesh', selected);
}

const usermenu = ref();
const usermenuitems = computed(()=>[{
	label: !!selectedMesh.value?`${selectedMesh.value?.agent?.name||'Unname'} (${selectedMesh.value?.agent?.username})`:user.value?.id,
	items: [
		{
				label: 'Copy Identity',
				icon: 'pi pi-copy',
				command(){
					ztmService.identity()
						.then(res => {
							if(!!res){
								copy(res)
							}
						})
						.catch(err => {
							loading.value = false;
							console.log('Request Failed', err)
						}); 
				},
		},
		{
				label: 'Download Identity',
				icon: 'pi pi-download',
				command(){
					ztmService.identity()
						.then(res => {
							if(!!res){
								downloadFile({
									data: res,
									fileName:`identity`,
									ext: 'txt'
								})
							}
						})
						.catch(err => {
							loading.value = false;
							console.log('Request Failed', err)
						}); 
				},
		},
	]
}]);

const toggleUsermenu = (event) => {
    usermenu.value.toggle(event);
};
const unread = computed(() => {
	return store.getters["notice/unread"];
});
const toggleLeft = () => {
	store.commit('account/setMobileLeftbar', !store.getters['account/mobileLeftbar']);
}
const goApp = (item) => {
	const webviewOptions = {
		url: item.url,
		name: item.label,
		width:item?.width || 1280,
		height:item?.height || 860,
		proxy:''
	}
	console.log(webviewOptions)
	openWebview(webviewOptions);
	focusMenu.value = item.url;
}
</script>

<template>
	<Menubar class="app-top-bar mobile-hidden" :model="model" breakpoint="0px">
			<template #start>
				<img @click.stop="toggleLeft" class="logo mt-3 mb-1" style="cursor: pointer;" @mouseleave="logoHover = false" @mouseover="logoHover = true" :src="XeyeSvg" height="50"/>
			</template>
			<template #item="{ item, props, hasSubmenu, root }">
					<router-link v-if="item.route && !item.cond" v-slot="{ href, navigate }" :to="item.route" custom>
							<a class="flex flex-column" :class="{'actived':focusMenu == item.route}" v-ripple :href="href" v-bind="props.action"  @click="() => { focusMenu = item.route;return navigate}">
									<Badge v-if="item.label == 'Chat' && unread>0" :value="unread" severity="danger" class="absolute" style="right: 2px;top:2px"/>
									<svg v-if="item.svg" class="svg w-2rem h-2rem" aria-hidden="true">
										<use :xlink:href="item.svg"></use>
									</svg>
									<div v-else class="menu-icon" :class="item.icon" />
									<div class="text-sm" >{{ t(item.label) }}</div>
							</a>
					</router-link>
					<a class="flex flex-column" v-else-if="!!item.url" v-ripple :href="item.url" :target="item.target" v-bind="props.action">
							<svg v-if="item.svg" class="svg w-2rem h-2rem" aria-hidden="true">
								<use :xlink:href="item.svg"></use>
							</svg>
							<div v-else class="menu-icon" :class="item.icon" />
							<div class="text-sm">{{ t(item.label) }} </div>
							<!-- <span v-if="hasSubmenu" class="pi pi-fw pi-angle-right ml-2 relative" style="top: 2px;" /> -->
					</a>
					<a :class="{'actived':focusMenu == item.url}" class="flex flex-column" v-else-if="!!item.url" v-ripple href="javascript:void(0)" @click="goApp(item)" v-bind="props.action">
							<svg v-if="item.svg" class="svg w-2rem h-2rem" aria-hidden="true">
								<use :xlink:href="item.svg"></use>
							</svg>
							<div v-else class="menu-icon" :class="item.icon" />
							<div class="text-sm">{{ t(item.label) }} </div>
							<!-- <span v-if="hasSubmenu" class="pi pi-fw pi-angle-right ml-2 relative" style="top: 2px;" /> -->
					</a>
			</template>
			<template #end >
					<div class="flex align-items-center flex-column w-full">
						
							<div @click="toggleUsermenu" class="w-full flex flex-column justify-content-center align-items-center py-3">
									<Avatar  icon="pi pi-user" class="mb-2" style="background-color: #9855f7;" shape="circle" />
									<div class="text-ellipsis w-full text-sm px-2 text-center"><b>{{selectedMesh?.agent?.name||selectedMesh?.agent?.username||'Agent'}}</b></div>
									<!-- <Tag >{{selectedMesh?.agent?.username||'User'}}</Tag> -->
							</div>
						<MeshSelector
							:full="true" 
							@load="load" 
							@select="select"/>
						<!-- <Menu ref="menu" id="overlay_menu" :model="items" :popup="true" @click="menuClick"/> -->
					</div>
					
			</template>
	</Menubar>
   <Menu ref="usermenu" id="user_menu" :model="usermenuitems" :popup="true" />
</template>

<style scoped lang="scss">
:deep(.p-select-dropdown) {
  display: none;
}
</style>
