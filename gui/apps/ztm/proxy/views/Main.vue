<script setup>
import { ref, onMounted,onActivated, computed,watch } from "vue";
import Editor from './Editor.vue'
import ProxyService from '../service/ProxyService';
import { dayjs,extend } from '@/utils/dayjs';
import { useStore } from 'vuex';
import { useI18n } from 'vue-i18n';
const { t, locale } = useI18n();
extend(locale.value)

const store = useStore();
const visibleEditor = ref(false);
const proxyService = new ProxyService();
const save = (tunnel) => {
	loaddata(tunnel);
}
const endpoints = ref([]);
onMounted(()=>{
	loaddata()
})
const loaddata = (endpoint) => {
	getEndpoints(endpoint);
}
const timeago = computed(() => (ts) => {
	let label = t("Last heartbeat")+ ": ";
	if(ts>0){
		const date = new Date(ts);
		return label + dayjs(date).fromNow();
	} else {
		return label + t("None");
	}
})
const selectedEp = ref();
const loading = ref(false);
const loader = ref(false);
const error = ref();
const getEndpoints = (endpoint) => {
	loading.value = true;
	loader.value = true;
	proxyService.getEndpoints().then((res)=>{
		loading.value = false;
		setTimeout(() => {
			loader.value = false;
		},2000)
		error.value = null;
		endpoints.value = res || [];
		if(!!endpoint){
			const _find = endpoints.value.find((_t) => _t.id == endpoint.id)
			if(!!_find){
				selectedEp.value = _find;
				visibleEditor.value = true;
			} else {
				selectedEp.value = null;
				visibleEditor.value = false;
			}
		}
		loadproxys();
	})
}
const select = (node) => {
	selectedEp.value = null;
	visibleEditor.value = false;
	setTimeout(()=>{
		visibleEditor.value = true;
		selectedEp.value = node;
	},100)
}
const info = computed(() => {
	return store.getters['app/info']
});


const loadproxys = () => {
	const reqs = []
	endpoints.value.forEach((ep)=>{
		proxyService.getProxy(ep?.id).then((res)=>{
			ep.proxy = res;
		})
	})
}
</script>

<template>
	<div class="flex flex-row min-h-screen" >
		<div class="relative h-full" :class="{'w-22rem':!!selectedEp,'w-full':!selectedEp,'mobile-hidden':!!selectedEp}">
			<AppHeader :child="true">
					<template #center>
						<b>{{t('Proxy')}} ({{endpoints.length}} {{t('Endpoints')}})</b>
					</template>
			
					<template #end> 
						<Button icon="pi pi-refresh" text @click="getEndpoints"  :loading="loader"/>
					</template>
			</AppHeader>
			<Loading v-if="loading"/>
			<ScrollPanel class="absolute-scroll-panel" v-else-if="endpoints && endpoints.length >0">
			<DataView class="message-list" :value="endpoints">
					<template #list="slotProps">
							<div class="flex flex-col message-item pointer" v-for="(node, index) in slotProps.items" :key="index" @click="select(node)">
								<div class="flex flex-col py-3 px-3 gap-4 w-full" :class="{ 'border-t border-surface-200 dark:border-surface-700': index !== 0 }">
										<div class="w-40 relative">
											<Avatar icon="pi pi-user" size="small" style="background-color: #ece9fc; color: #2a1261" />
										</div>
										<div class="flex-item" style="min-width: 150px;">
												<div class="flex">
													<div class="flex-item pt-1">
														<b>{{ node.name || t('Unknow EP') }}</b>
														<Tag class="ml-2" v-if="node.id == info.endpoint?.id" severity="contrast" >{{t('Local')}}</Tag>
													</div>
												</div>
										</div>
										<div class="grid align-items-center justify-content-end pr-2 gap-1 pt-3" v-if="!visibleEditor && node.proxy">
											<Tag v-if="node.proxy?.listen" severity="secondary" value="Secondary">{{t('Listen')}} {{node.proxy.listen}}</Tag> 
											<Tag v-show="index<2" v-if="node.proxy?.targets" v-for="(target,index) in node.proxy?.targets" severity="secondary" value="Secondary">{{t('Target')}} {{target}}</Tag> 
											<Tag v-if="!!node.proxy?.targets && node.proxy?.targets.length>2" v-tooltip="JSON.stringify(node.proxy?.targets)"  severity="secondary" value="Secondary">...</Tag>
											<Tag v-show="index<2" v-if="node.proxy?.exclusions" v-for="(exclusion,index) in node.proxy?.exclusions" severity="secondary" value="Secondary">{{t('Exclusion')}} {{exclusion}}</Tag> 
											<Tag v-if="!!node.proxy?.exclusions && node.proxy?.exclusions.length>2" v-tooltip="JSON.stringify(node.proxy?.exclusions)"  severity="secondary" value="Secondary">...</Tag> 
											<Tag v-if="node.proxy?.allow" severity="secondary" value="Secondary" v-tooltip.bottom="node.proxy.allow.join('\n')">{{t('Allow')}} <Badge :value="node.proxy.allow.length"/></Tag> 
											<Tag v-if="node.proxy?.deny" severity="secondary" value="Secondary" v-tooltip.bottom="node.proxy.deny.join('\n')">{{t('Deny')}} <Badge :value="node.proxy.deny.length"/></Tag> 
										</div>
								</div>
							</div>
					</template>
			</DataView>
			</ScrollPanel>
			<Empty v-else :title="t('No endpoint.')"/>
		</div>
		<div class="flex-item h-full shadow" v-if="!!visibleEditor">
			<div class="h-full mobile-fixed" >
				<Editor
					:ep="selectedEp" 
					@save="save" 
					@back="() => {selectedEp=null;visibleEditor=false;}"/>
			</div>
		</div>
	</div>
</template>

<style scoped lang="scss">
</style>