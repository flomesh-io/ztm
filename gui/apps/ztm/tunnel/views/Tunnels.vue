<script setup>
import { ref, onMounted,onActivated, computed,watch } from "vue";
import { useRouter } from 'vue-router'
import { useConfirm } from "primevue/useconfirm";
import { useStore } from 'vuex';
import { useI18n } from 'vue-i18n';
import { isMobileWidth } from '@/utils/platform';
const { t } = useI18n();
const store = useStore();

const confirm = useConfirm();
const router = useRouter();
const scopeType = ref('All');
const portMap = ref({});

onMounted(()=>{
})
const props = defineProps(['small','tunnels','error','loading','loader'])
const emits = defineEmits(['create', 'edit','load'])


const tunnelsFilter = computed(() => {
	return props.tunnels.filter((tunnel)=>{
		return (typing.value == '' || tunnel.name.indexOf(typing.value)>=0 ) 
	})
});

const typing = ref('');
const actionMenu = ref();
const actions = ref([
    {
        label: t('Actions'),
        items: [
            {
                label: t('Edit'),
                icon: 'pi pi-pencil',
								command: () => {
								}
            },
        ]
    }
]);
const showAtionMenu = (event, tunnel) => {
	actionMenu.value.toggle(event);
};
const layout = ref('grid');
const back = () => {
	router.go(-1)
}

const isMobile = computed(isMobileWidth);

const emptyMsg = computed(()=>{
	return t('No tunnels.')
});
const load = () => {
	emits('load')
}
const create = () => {
	emits('create')
}

const edit = (d) => {
	emits('edit',d)
}
const inboundsInfo = computed(() => (inbounds) => {
	let rtn = "";
	(inbounds || []).forEach((n)=>{
		// const _listens = [];
		// n.listens.forEach(m=>{
		// 	_listens.push(m.value)
		// })
		rtn += `${n?.username}:${n?.name}\r\n`;
	});
	return rtn;
	//${_listens.join(',')}
})

const outboundsInfo = computed(() => (outbounds) => {
	let rtn = "";
	(outbounds || []).forEach((n)=>{
		rtn += `${n?.username}:${n?.name}\r\n`;
	})
	return rtn;
	//{n.targets.join(',')
})
</script>

<template>
	<div class="flex flex-row min-h-screen"  :class="{'embed-ep-header':false}">
		<div  class="relative h-full w-full min-h-screen" >
			<AppHeader :child="true">
					<template #center>
						<b>{{t('Tunnels')}}</b>
					</template>
					<template #end> 
						<Button icon="pi pi-refresh" text @click="load"  :loading="loader"/>
						<Button icon="pi pi-plus"   @click="create"/>
					</template>
			</AppHeader>
			<Card class="nopd" v-if="!props.error">
				<template #content>
					<InputGroup class="search-bar" >
						<DataViewLayoutOptions v-if="!isMobile" v-model="layout" style="z-index: 2;"/>
						<Textarea @keyup="watchEnter" v-model="typing" :autoResize="true" class="drak-input bg-gray-900 text-white flex-1" :placeholder="t('Type tunnel name')" rows="1" cols="30" />
						<Button :disabled="!typing" icon="pi pi-search"  :label="null"/>
					</InputGroup>
				</template>
			</Card>
			<Loading v-if="props.loading"/>
			<ScrollPanel class="absolute-scroll-panel bar" v-else-if="tunnelsFilter && tunnelsFilter.length >0">
			<div class="text-center">
				<DataTable v-if="layout == 'list'" class="nopd-header w-full" :value="tunnelsFilter" dataKey="id" tableStyle="min-width: 50rem">
						<Column :header="t('Tunnel')">
							<template #body="slotProps">
								<span class="block text-tip font-medium"><i class="pi pi-arrow-right-arrow-left text-tip mr-2"></i> {{slotProps.data.name}}</span>
							</template>
						</Column>
						<Column :header="t('Inbound')">
							<template #body="slotProps">
								<Badge  v-tooltip="inboundsInfo(slotProps.data.inbound)" v-if="slotProps.data.inbound" :value="slotProps.data.inbound.length"/>
							</template>
						</Column>
						<Column :header="t('Outbound')">
							<template #body="slotProps">
								<Badge  v-tooltip="outboundsInfo(slotProps.data.outbound)" v-if="slotProps.data.outbound" :value="slotProps.data.outbound.length"/>
							</template>
						</Column>
						<Column :header="t('Action')"  style="width: 110px;">
							<template #body="slotProps">
								 <div @click="edit(slotProps.data)" v-tooltip="t('Edit')"   class="pointer flex align-items-center justify-content-center bg-primary-sec border-round mr-2" :style="'width: 2rem; height: 2rem'">
										 <i class="pi pi-pencil text-xl"></i>
								 </div>
							</template>
						</Column>
				</DataTable>
				<div v-else class="grid text-left mt-1 px-3">
						<div  :class="(!props.small)?'col-12 md:col-6 lg:col-4':'col-12'" v-for="(tunnel,hid) in tunnelsFilter" :key="hid">
							 <div class="surface-card shadow-2 p-3 border-round">
									 <div class="flex justify-content-between">
											 <div>
													<span class="block text-tip font-medium mb-3"><Tag severity="contrast" class="mr-1">{{tunnel.protocol.toUpperCase()}}</Tag> {{tunnel.name}}</span>
													<div class="text-left w-full" >
														<Tag v-tooltip="inboundsInfo(tunnel.inbound)" severity="secondary" value="Secondary">{{t('Inbounds')}}: <Badge :value="tunnel.inbound.length"/></Tag> 
														<Tag v-tooltip="outboundsInfo(tunnel.outbound)" class="ml-2" severity="secondary" value="Secondary">{{t('Outbounds')}}: <Badge :value="tunnel.outbound.length"/></Tag> 
													</div>
											 </div>
											 <div class="flex">
												 <div @click="edit(tunnel)" v-tooltip="t('Edit')"   class="pointer flex align-items-center justify-content-center bg-primary-sec border-round mr-1" :style="'width: 2rem; height: 2rem'">
														 <i class="pi pi-pencil text-xl"></i>
												 </div><!-- 
												 <div  @click="showAtionMenu($event, tunnel)" aria-haspopup="true" aria-controls="actionMenu" class="pointer flex align-items-center justify-content-center p-button-secondary border-round" style="width: 2rem; height: 2rem">
													<i class="pi pi-ellipsis-v text-tip text-xl"></i>
												 </div> -->
											 </div>
									 </div>
							 </div>
					 </div>
				</div>
				<Menu ref="actionMenu" :model="actions" :popup="true" />
			</div>
			</ScrollPanel>
			<Empty v-else :title="emptyMsg" :error="props.error"/>
		</div>
	</div>
</template>

<style scoped lang="scss">
:deep(.p-dataview-content) {
  background-color: transparent !important;
}
:deep(.p-tabview-nav),
:deep(.p-tabview-panels),
:deep(.p-tabview-nav-link){
	background: transparent !important;
}
:deep(.p-tabview-panels){
	padding: 0;
}
</style>