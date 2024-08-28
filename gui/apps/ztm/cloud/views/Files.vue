<script setup>
import { ref, onMounted,onActivated, computed,watch } from "vue";
import { useRouter } from 'vue-router'
import FileService from '../service/FileService';
import { checker, bitUnit } from '@/utils/file';
import { useConfirm } from "primevue/useconfirm";
import { useStore } from 'vuex';
import { platform } from '@/utils/platform';
import { copy } from '@/utils/clipboard';
const store = useStore();
const confirm = useConfirm();
const router = useRouter();
const fileService = new FileService();
const scopeType = ref('All');
const portMap = ref({});

const props = defineProps(['small','files','error','loading','loader'])
const emits = defineEmits(['create', 'edit','load'])


const fileData = ref([]);
const formatFile = (ary, pre) => {
		props.files.forEach((file,idx)=>{
			const _file = {
				key:`${pre}${idx}`,
				name:file,
				loading:false,
				selected: false,
				ext:file.charAt(file.length-1) == "/"?"/":file.split(".")[file.split(".").length-1]
			}
			if(_file.ext == "/"){
				_file.children = [];
				_file.leaf = false;
			}
			ary.push(_file);
		})
}

watch(()=>props.files,()=>{
	fileData.value = [];
	if(!!props.files && props.files.length>0){
		formatFile(fileData.value,'');
	}
},{
	deep:true,
	immediate:true,
});

const filesFilter = computed(() => {
	return fileData.value.filter((file)=>{
		return (typing.value == '' || file.name.indexOf(typing.value)>=0 ) 
	})
});
const visible = ref(false);
const typing = ref('');
const actionMenu = ref();
const showAtionMenu = (e) => {
	visible.value = true;
};
const layout = ref('grid');
const windowWidth = ref(window.innerWidth);
const isMobile = computed(() => windowWidth.value<=768);

const emptyMsg = computed(()=>{
	return 'No file.'
});
const load = () => {
	emits('load',currentPath.value)
}
const create = () => {
	emits('create')
}

const edit = (d) => {
	emits('edit',d)
}

const fileLoading = ref({})


const onNodeExpand = (node) => {
    if (node.ext == "/") {
        node.loading = true;

        setTimeout(() => {

            node.children = [];

						formatFile(node.children,`${node.key}-`);
						node.loading = false;
      //       let _nodes = { ...nodes2.value };
						
      //       _nodes[parseInt(node.key, 10)] = { ..._node, loading: false };

      //       nodes2.value = _nodes;
        }, 500);
    }
};

const home = ref({ type: 'home',icon: 'pi pi-angle-left' });
const currentPath = ref('');
const itemsBreadcrumb = ref([
	{
		name: 'root',
		path: '',
		index:0,
	}
]);

const back = () => {
	if(window.parent){
		window.parent.location.href="/#/mesh/apps";
	}else{
		location.href="/#/mesh/apps";
	}
}
const showBack = computed(()=>{
	return platform() == 'ios' || platform() == 'android' || platform() == 'web'
})
const changePath = (item) => {
	if(item.index+1 < itemsBreadcrumb.value.length){
		itemsBreadcrumb.value.splice(item.index+1,itemsBreadcrumb.value.length-1-item.index)
	}
	currentPath.value = item.path;
	load();
}
const openFile = ref();
const selectFile = (e, item) => {
	if(item.ext == "/"){
		const _name = item.name.split("/")[0];
		currentPath.value = !!currentPath.value?`${currentPath.value}/${_name}`:_name;
		itemsBreadcrumb.value.push({
			name:_name,
			path:currentPath.value,
			index:itemsBreadcrumb.value.length
		});
		
		load();
	} else if(!item.selected) {
		item.selected = { time:new Date(),value:true };
		openFile.value = null;
	} else if(!!item.selected) {
		const diff = Math.abs((new Date()).getTime() - item.selected.time.getTime());
		if(diff <= 600){
			item.selected.time = new Date();
			loadFileAttr(item);
			showAtionMenu(e);
		} else {
			item.selected.value = !item.selected.value;
			item.selected.time = new Date();
			openFile.value = null;
		}
	}
}

const actions = computed(()=>{
	return [
		{
				label: 'State',
				shortcut: openFile.value?.state,
				command: () => {
				}
		},
		{
				label: 'Sources',
				badge: openFile.value?.sources?.length,
				command: () => {
				}
		},
		
		
		{
				label: 'Path',
				shortcut: openFile.value?.path,
				command: () => {
				}
		},
		{
				label: 'Hash',
				shortcut: openFile.value?.hash,
				command: () => {
				}
		},
		{
				label: 'Time',
				shortcut: openFile.value?new Date(openFile.value.time).toLocaleString():'',
				command: () => {
				}
		},
		{
				label: 'Size',
				shortcut: bitUnit(openFile.value?.size),
				command: () => {
				}
		},
	]
})
const loadFileAttr = (item) => {
	setTimeout(()=> {
		openFile.value = {
			...item,
			"sources": ["86540a10-576d-47d1-8d9f-e0184830f152"],
			"path": "/users/root/89.mp4",
			"state":"missing",
			"size":1024*1024,
			"time": 1724328877486,
			"hash": "48effab79269626be8604ad98e394a4f2ed2850fce79abfa6e49975d147464f" ,
			"downloading":0.931241211
		}
	},300)
}
const copyFile = () => {
	copy(JSON.stringify(openFile.value))
}
const closeFile = () => {
	openFile.value = null;
	visible.value = false;
}
</script>

<template>
	<div class="flex flex-row min-h-screen h-full" :class="{'embed-ep-header':false}" @click="closeFile">
		<div  class="relative h-full w-full" >
			<AppHeader :child="true">
			
					<template #start>
						 <Breadcrumb v-if="props.mode != 'device'" :home="home" :model="itemsBreadcrumb">
								<template #item="{ item }">
									<Button  v-if="item.type=='home' && showBack" @click="back" icon="pi pi-angle-left" severity="secondary" text />
									<Button v-else @click="changePath(item)" :label="item.name" severity="secondary" text />
								</template>
								<template #separator> / </template>
						</Breadcrumb>
					</template>
					<template #center>
						<!-- <b>Files</b> -->
					</template>
					<template #end> 
						<Button icon="pi pi-refresh" text @click="load"  :loading="loader"/>
						<Button icon="pi pi-plus"   @click="create"/>
					</template>
			</AppHeader>
			<Card class="nopd" v-if="!props.error">
				<template #content>
					<InputGroup class="search-bar" >
						<DataViewLayoutOptions v-model="layout" style="z-index: 2;"/>
						<Textarea @keyup="watchEnter" v-model="typing" :autoResize="true" class="drak-input bg-gray-900 text-white flex-1" placeholder="Type file name" rows="1" cols="30" />
						<Button :disabled="!typing" icon="pi pi-search"  :label="null"/>
					</InputGroup>
				</template>
			</Card>
			<Loading v-if="props.loading"/>
			<ScrollPanel class="absolute-scroll-panel"  :style="{'top':'50px'}" v-else-if="filesFilter && filesFilter.length >0">
			<div class="text-center" >
				<TreeTable v-if="layout == 'list'" @node-expand="onNodeExpand" loadingMode="icon" class="w-full file-block" :value="filesFilter" >
						<Column field="name" header="Name" expander style="min-width: 12rem">
								<template  #body="slotProps">
									<div class="selector pointer "   @click.stop="selectFile($event,slotProps.node)" :class="{'active':!!slotProps.node.selected?.value,'px-2':!!slotProps.node.selected?.value,'py-1':!!slotProps.node.selected?.value}" >
										<img :src="checker(slotProps.node.name)" class="relative vertical-align-middle" width="20" height="20" style="top: -1px; overflow: hidden;margin: auto;"/>
										<b class="px-2 vertical-align-middle">{{ slotProps.node.name }}</b>
									</div>
								</template>
						</Column>
				</TreeTable>
				<div v-else class="grid text-left px-3 m-0" v-if="filesFilter && filesFilter.length >0">
						<div class="col-4 md:col-2 xl:col-1 relative text-center file-block" v-for="(file,hid) in filesFilter" :key="hid">
							<div class="selector py-3" @click.stop="selectFile($event,file)" :class="{'active':!!file.selected?.value}" >
								<img :src="checker(file.name)" class="pointer" width="40" height="40" style="border-radius: 4px; overflow: hidden;margin: auto;"/>
								<ProgressSpinner v-if="file.loading" class="absolute opacity-60" style="width: 30px; height: 30px;margin-left: -35px;margin-top: 5px;" strokeWidth="10" fill="#000"
										animationDuration="2s" aria-label="Progress" />
								<div class="mt-1" v-tooltip="file">
									<b class="white-space-nowrap">
										<!-- <i v-if="app.uninstall" class="pi pi-cloud-download mr-1" /> -->
										{{ file.name }}
									</b>
								</div>
							</div>
					 </div>
				</div>
				<Dialog class="nopd noheader" v-model:visible="visible" :dismissableMask="true" :draggable="true" >
					 <Menu v-show="visible" :model="actions" class="w-60">
					     <template #start>
					 			<div v-if="openFile" class="text-center pt-4 relative">
					 				<img :src="checker(openFile.name)" class="pointer" width="40" height="40" style="border-radius: 4px; overflow: hidden;margin: auto;"/>
					 				<div class="px-2 ">
					 					<Button @click="copyFile" iconPos="right" icon="pi pi-copy" plain :label="openFile.name" text />
					 				</div>
					 			</div>
					 			
					     </template>
					     <template #submenulabel="{ item }">
					         <span class="text-primary font-bold">{{ item.label }}</span>
					     </template>
					     <template #item="{ item, props }">
					         <a v-ripple class="flex items-center" v-bind="props.action">
					             <span :class="item.icon" />
					             <span>{{ item.label }}</span>
					             <Badge v-if="item.badge" class="ml-auto" :value="item.badge" />
					             <span v-if="item.shortcut" class="ml-auto border border-surface rounded bg-emphasis text-muted-color text-xs p-1 max-w-12rem text-right" style="word-break: break-all;">
					 							<Tag v-if="item.label == 'State'">{{ item.shortcut }}</Tag>
					 							<span v-else>{{ item.shortcut }}</span>
					 						</span>
					         </a>
					     </template>
					     <template #end v-if="openFile?.downloading">
					 			
					 			<div class="px-4 pt-2 pb-1">
					 					<ProgressBar :value="openFile.downloading*100"></ProgressBar>
					 			</div>
					 			<div class="px-3 pt-2 pb-3 flex justify-content-between">
					 				<div  class="flex-item px-2">
					 					<Button class="w-full" icon="pi pi-cloud-download" label="Download" severity="secondary"  />
					 				</div>
					 				<div  class="flex-item px-2">
					 					<Button class="w-full" icon="pi pi-cloud-upload" label="Upload" severity="secondary" />
					 				</div>
					 			</div>
					     </template>
					 </Menu>
				</Dialog>
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