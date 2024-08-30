<script setup>
import { ref, onMounted,onActivated, computed,watch } from "vue";
import { useRouter } from 'vue-router'
import FileService from '../service/FileService';
import { checker, bitUnit, openFile } from '@/utils/file';
import { useConfirm } from "primevue/useconfirm";
import { useStore } from 'vuex';
import { platform } from '@/utils/platform';
import { copy } from '@/utils/clipboard';
import { merge } from '@/service/common/request';
import { useToast } from "primevue/usetoast";
import { homeDir } from '@tauri-apps/api/path';
const toast = useToast();
const store = useStore();
const confirm = useConfirm();
const router = useRouter();
const fileService = new FileService();
const scopeType = ref('All');
const portMap = ref({});

const props = defineProps(['small','files','error','loading','loader','queueSize'])
const emits = defineEmits(['download','upload','load'])
const info = computed(() => {
	return store.getters['app/info']
});

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

const fileLoading = ref({})


const onNodeExpand = (node) => {
    if (node.ext == "/") {
        node.loading = true;

        setTimeout(() => {

            node.children = [];

						formatFile(node.children,`${node.key}-`);
						node.loading = false;
        }, 500);
    }
};

const home = ref({ type: 'home',icon: 'pi pi-angle-left' });
const currentPath = ref('');
const itemsBreadcrumb = ref([
	{
		name: 'Setting',
		icon: 'pi pi-cog',
		path: '',
		index:0,
	},
	{
		name: 'Root',
		icon: 'pi pi-warehouse',
		path: '',
		index:1,
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
const selectedFile = ref();
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
		selectedFile.value = null;
	} else if(!!item.selected) {
		const diff = Math.abs((new Date()).getTime() - item.selected.time.getTime());
		if(diff <= 600){
			item.selected.time = new Date();
			loadFileAttr(item);
			showAtionMenu(e);
		} else {
			item.selected.value = !item.selected.value;
			item.selected.time = new Date();
			selectedFile.value = null;
		}
	}
}

const actions = computed(()=>{
	return [
		{
				label: 'State',
				shortcut: selectedFile.value?.state,
				command: () => {
				}
		},
		{
				label: 'Sources',
				badge: selectedFile.value?.sources?.length,
				command: () => {
				}
		},
		
		
		{
				label: 'Path',
				shortcut: selectedFile.value?.path,
				command: () => {
				}
		},
		{
				label: 'Hash',
				shortcut: selectedFile.value?.hash,
				command: () => {
				}
		},
		{
				label: 'Time',
				shortcut: selectedFile.value?new Date(selectedFile.value.time).toLocaleString():'',
				command: () => {
				}
		},
		{
				label: 'Size',
				shortcut: bitUnit(selectedFile.value?.size),
				command: () => {
				}
		},
	]
})
const attrLoading = ref(false);
const loadFileAttr = (item) => {
	attrLoading.value = true;
	const _joinPath = [];
	const _pre = currentPath.value;
	if(!!_pre){
		_joinPath.push(_pre)
	}
	_joinPath.push(item.name);
	fileService.getFiles(_joinPath.join("/")).then((res)=>{
		attrLoading.value = false;
		selectedFile.value = {
			...item,
			...res,
		}
	})
}
const copyFile = () => {
	copy(JSON.stringify(selectedFile.value))
}
const closeFile = () => {
	selectedFile.value = null;
	visible.value = false;
}
const getSelectFiles = (list) => {
	let ary = []
	list.forEach((item)=>{
		if(!!item.selected?.value){
			ary.push(item)
		}
		if(item.children){
			ary = ary.concat(getSelectFiles(item.children)||[])
		}
	});
	return ary;
}
const selectedFiles = computed(()=>{
	return getSelectFiles(fileData.value);
})
const op = ref();
const openSetting = () => {
	op.value.toggle(event);
}
const config = ref({
	localDir: "",
	mirrors: []
})
const saveConfig = () => {
	fileService.setConfig(info.value?.endpoint?.id, config.value).then(()=>{
		toast.add({ severity: 'success', summary:'Tips', detail: 'Save successfully.', life: 3000 });
		getConfig();
	})
}
const selectDir = (dir) => {
	config.value.localDir = dir;
}
const copyDir = () => {
	copy(config.value.localDir)
}

const hasTauri = ref(!!window.__TAURI_INTERNALS__);
const getConfig = () => {
	fileService.getConfig(info.value?.endpoint?.id).then((res)=>{
		config.value = res;
		if(config.value.localDir == '~/ztmCloud' && !!hasTauri.value){
			homeDir().then((dir)=>{
				config.value.localDir = dir;
				fileService.setConfig(info.value?.endpoint?.id, config.value).then(()=>{
					getConfig();
				})
			})
		}
	})
}

const openQueue = () => {
	emits('download',{})
	emits('upload',{})
}
const doDownload = (item) => {
	if(item.path){
		fileService.download(item.path).then((res)=>{
			toast.add({ severity: 'contrast', summary:'Tips', detail: `${item.name} in the download queue.`, life: 3000 });
			emits('download',item)
		})
	}
}
const doDownloads = () => {
	if(selectedFiles.value.length>0){
		const reqs = [];
		selectedFiles.value.forEach((item)=>{
			if(item.state == "outdated" || item.state == "missing"){
				reqs.push(fileService.download(item.path));
			}
		})
	}
	if(reqs.length>0){
		merge(reqs).then((allRes) => {
			toast.add({ severity: 'contrast', summary:'Tips', detail: `${selectedFiles.value.length} files in the download queue.`, life: 3000 });
			emits('download',selectedFiles.value)
		})
	}
}

const doUpload = (item) => {
	if(item.path){
		fileService.upload(item.path).then((res)=>{
			toast.add({ severity: 'contrast', summary:'Tips', detail: `${item.name} in the upload queue.`, life: 3000 });
			emits('upload',item)
		})
	}
}
const doUploads = () => {
	if(selectedFiles.value.length>0){
		const reqs = [];
		selectedFiles.value.forEach((item)=>{
			if(item.state == "new" || item.state == "changed"){
				reqs.push(fileService.upload(item.path));
			}
		})
	}
	if(reqs.length>0){
		merge(reqs).then((allRes) => {
			toast.add({ severity: 'contrast', summary:'Tips', detail: `${selectedFiles.value.length} files in the upload queue.`, life: 3000 });
			emits('upload',selectedFiles.value)
		})
	}
}
const fileIcon = computed(()=>(name)=>{
	return checker(name, currentPath.value)
})
onMounted(()=>{
	getConfig();
})
</script>

<template>
	<div class="flex flex-row min-h-screen h-full" :class="{'embed-ep-header':false}" @click="closeFile">
		<div  class="relative h-full w-full" >
			<AppHeader :child="true">
					<template #start>
						 <Breadcrumb v-if="props.mode != 'device'" :home="home" :model="itemsBreadcrumb">
								<template #item="{ item }">
									<Button v-if="item.type=='home' && showBack" @click="back" icon="pi pi-angle-left" severity="secondary" text />
									<Button v-else-if="item.name == 'Setting'" @click="openSetting()" v-tooltip="item.name" :icon="item.icon" severity="secondary" text aria-haspopup="true" aria-controls="op"/>
									<Button v-else-if="item.name == 'Root'" @click="changePath(item)" v-tooltip="`${item.name}:${config.localDir}`" :icon="item.icon" severity="secondary" text />
									<Button v-else-if="item.icon" @click="changePath(item)" v-tooltip="item.name" :icon="item.icon" severity="secondary" text />
									<Button v-else @click="changePath(item)" :label="item.name" severity="secondary" text />
								</template>
								<template #separator> / </template>
						</Breadcrumb>
						<span class="text-black-alpha-40 mx-2">/</span>
						<Button @click="openFile(`${config.localDir}/${currentPath}`)" v-tooltip="'Open folder'" icon="pi pi-folder-open" severity="secondary" text />
					</template>
					<template #center>
						<!-- <b>Files</b> -->
					</template>
					<template #end> 
						<Button icon="pi pi-refresh" text @click="load"  :loading="loader"/>
						<Button v-if="selectedFiles.length>0" label="Upload" text @click="doUploads" />
						<Button v-if="selectedFiles.length>0" severity="secondary" label="Download" @click="doDownloads" />
						<Button @click="openQueue">
							<i class="pi pi-inbox"/>
							<Badge v-if="!!props.queueSize" :value="props.queueSize" size="small"></Badge>
						</Button>
					</template>
			</AppHeader>
			<Popover ref="op" >
				<div class="flex w-full">
					<InputText size="small" placeholder="Local Dir" v-model="config.localDir"  class="flex-item"></InputText>
					<Button v-tooltip="'Save'" size="small" :disabled="!config.localDir" icon="pi pi-check" class="ml-2"  @click="saveConfig"></Button>
					<Button v-tooltip="'Copy'" size="small" :disabled="!config.localDir" icon="pi pi-copy" class="ml-2"  @click="copyDir"></Button>
					<FileFolderSelector v-if="hasTauri" :path="config.localDir" class="pointer ml-2" placeholder="Open" @select="selectDir"></FileFolderSelector>
				</div>
			</Popover>
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
			<ScrollPanel class="absolute-scroll-panel bar" v-else-if="filesFilter && filesFilter.length >0">
			<div class="text-center" >
				<TreeTable v-if="layout == 'list'" @node-expand="onNodeExpand" loadingMode="icon" class="w-full file-block" :value="filesFilter" >
						<Column field="name" header="Name" expander style="min-width: 12rem">
								<template  #body="slotProps">
									<div class="selector pointer "   @click.stop="selectFile($event,slotProps.node)" :class="{'active':!!slotProps.node.selected?.value,'px-2':!!slotProps.node.selected?.value,'py-1':!!slotProps.node.selected?.value}" >
										<img :src="fileIcon(slotProps.node.name)" class="relative vertical-align-middle" width="20" height="20" style="top: -1px; overflow: hidden;margin: auto;"/>
										<b class="px-2 vertical-align-middle">{{ slotProps.node.name }}</b>
									</div>
								</template>
						</Column>
				</TreeTable>
				<div v-else class="grid text-left px-3 m-0 pt-1" v-if="filesFilter && filesFilter.length >0">
						<div :class="props.small?'col-4 md:col-4 xl:col-2':'col-4 md:col-2 xl:col-1'" class="relative text-center file-block" v-for="(file,hid) in filesFilter" :key="hid">
							<div class="selector p-2" @click.stop="selectFile($event,file)" :class="{'active':!!file.selected?.value}" >
								<img :src="fileIcon(file.name)" class="pointer" width="40" height="40" style="border-radius: 4px; overflow: hidden;margin: auto;"/>
								<ProgressSpinner v-if="file.loading" class="absolute opacity-60" style="width: 30px; height: 30px;margin-left: -35px;margin-top: 5px;" strokeWidth="10" fill="#000"
										animationDuration="2s" aria-label="Progress" />
								<div class="mt-1" v-tooltip="file">
									<b style="word-break: break-all;">
										<!-- <i v-if="app.uninstall" class="pi pi-cloud-download mr-1" /> -->
										{{ file.name }}
									</b>
								</div>
							</div>
					 </div>
				</div>
				<Dialog class="nopd noheader" v-model:visible="visible" :dismissableMask="true" :draggable="true" >
					 <Loading v-if="attrLoading" />
					 <Menu v-else :model="actions" class="w-60">
					     <template #start>
					 			<div v-if="selectedFile" class="text-center pt-4 relative">
					 				<img :src="fileIcon(selectedFile.name)" class="pointer" width="40" height="40" style="border-radius: 4px; overflow: hidden;margin: auto;"/>
					 				<div class="px-2 ">
					 					<Button @click="copyFile" iconPos="right" icon="pi pi-copy" plain :label="selectedFile.name" text />
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
					             <Badge v-if="item.badge>=0" class="ml-auto" :value="item.badge" />
					             <span v-if="item.shortcut" class="ml-auto border border-surface rounded bg-emphasis text-muted-color text-xs p-1 max-w-14rem text-right" style="word-break: break-all;">
					 							<Tag v-if="item.label == 'State'">{{ item.shortcut }}</Tag>
					 							<span v-else>{{ item.shortcut }}</span>
					 						</span>
					         </a>
					     </template>
					     <template #end v-if="selectedFile.state != 'synced'">
					 			<div class="px-4 pt-2 pb-1" v-if="selectedFile?.uploading">
					 					<ProgressBar :value="selectedFile.uploading*100"></ProgressBar>
					 			</div>
					 			<div class="px-4 pt-2 pb-1" v-if="selectedFile?.downloading">
					 					<ProgressBar :value="selectedFile.downloading*100"></ProgressBar>
					 			</div>
					 			<div class="px-3 pt-2 pb-3 flex justify-content-between">
					 				<div  class="flex-item px-2" v-if="selectedFile.state == 'new' || selectedFile.state == 'changed'">
					 					<Button :disabled="!selectedFile?.path" @click="doUpload(selectedFile)" class="w-full" icon="pi pi-cloud-upload" label="Upload" severity="secondary" />
					 				</div>
					 				<div  class="flex-item px-2" v-if="selectedFile.state == 'outdated' || selectedFile.state == 'missing'">
					 					<Button :disabled="!selectedFile?.path" @click="doDownload(selectedFile)" class="w-full" icon="pi pi-cloud-download" label="Download" severity="secondary"  />
					 				</div>
					 				<div  class="flex-item px-2" v-if="selectedFile.state != 'missing'">
					 					<Button :disabled="!selectedFile?.path" @click="openFile(`${config.localDir}${selectedFile?.path}`)" class="w-full" icon="pi pi-external-link" label="Open" severity="secondary"  />
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