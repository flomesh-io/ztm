<script setup>
import { ref, onMounted,onActivated, computed,watch } from "vue";
import { useRouter } from 'vue-router'
import FileService from '../service/FileService';
import { checker } from '@/utils/file';
import { useConfirm } from "primevue/useconfirm";
import { useStore } from 'vuex';
const store = useStore();
const confirm = useConfirm();
const router = useRouter();
const fileService = new FileService();
const scopeType = ref('All');
const portMap = ref({});

onMounted(()=>{
})
const props = defineProps(['small','files','error','loading','loader'])
const emits = defineEmits(['create', 'edit','load'])


const filesFilter = computed(() => {
	return props.files.filter((file)=>{
		return (typing.value == '' || file.name.indexOf(typing.value)>=0 ) 
	})
});

const typing = ref('');
const actionMenu = ref();
const actions = ref([
    {
        label: 'Actions',
        items: [
            {
                label: 'Edit',
                icon: 'pi pi-pencil',
								command: () => {
								}
            },
        ]
    }
]);
const showAtionMenu = (event, file) => {
	actionMenu.value.toggle(event);
};
const layout = ref('grid');
const back = () => {
	router.go(-1)
}

const windowWidth = ref(window.innerWidth);
const isMobile = computed(() => windowWidth.value<=768);

const emptyMsg = computed(()=>{
	return 'No file.'
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

const fileLoading = ref({})

</script>

<template>
	<div class="flex flex-row min-h-screen h-full"  :class="{'embed-ep-header':false}">
		<div  class="relative h-full w-full" >
			<AppHeader :child="true">
					<template #center>
						<b>Files</b>
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
						<Textarea @keyup="watchEnter" v-model="typing" :autoResize="true" class="drak-input bg-gray-900 text-white flex-1" placeholder="Type file name" rows="1" cols="30" />
						<Button :disabled="!typing" icon="pi pi-search"  :label="null"/>
					</InputGroup>
				</template>
			</Card>
			<Loading v-if="props.loading"/>
			<ScrollPanel class="absolute-scroll-panel" :style="{'top':'75px'}" v-else-if="filesFilter && filesFilter.length >0">
			<div class="text-center">
				<DataTable v-if="layout == 'list'" class="nopd-header w-full" :value="filesFilter" dataKey="id" tableStyle="min-width: 50rem">
						<Column header="File">
							<template #body="slotProps">
								<span class="block text-tip font-medium"><i class="pi pi-arrow-right-arrow-left text-tip mr-2"></i> {{slotProps.data.name}}</span>
							</template>
						</Column>
						<Column header="Inbound">
							<template #body="slotProps">
								<Badge v-if="slotProps.data.inbounds" :value="slotProps.data.inbounds.length"/>
							</template>
						</Column>
						<Column header="Outbound">
							<template #body="slotProps">
								<Badge v-if="slotProps.data.outbounds" :value="slotProps.data.outbounds.length"/>
							</template>
						</Column>
						<Column header="Action"  style="width: 110px;">
							<template #body="slotProps">
								 <div @click="edit(slotProps.data)" v-tooltip="'Edit'"   class="pointer flex align-items-center justify-content-center bg-primary-sec border-round mr-2" :style="'width: 2rem; height: 2rem'">
										 <i class="pi pi-pencil text-xl"></i>
								 </div>
							</template>
						</Column>
				</DataTable>
				<div v-else class="grid text-left px-3" v-if="filesFilter && filesFilter.length >0">
						<div  class="col-4 md:col-2 lg:col-1 py-3 relative text-center " v-for="(file,hid) in filesFilter" :key="hid">
							<img :src="checker(file)" class="pointer" width="40" height="40" style="border-radius: 4px; overflow: hidden;margin: auto;"/>
							<ProgressSpinner v-if="fileLoading[file]" class="absolute opacity-60" style="width: 30px; height: 30px;margin-left: -35px;margin-top: 5px;" strokeWidth="10" fill="#000"
									animationDuration="2s" aria-label="Progress" />
							<div class="mt-1" v-tooltip="file">
								<b class="white-space-nowrap">
									<!-- <i v-if="app.uninstall" class="pi pi-cloud-download mr-1" /> -->
									{{ file }}
								</b>
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