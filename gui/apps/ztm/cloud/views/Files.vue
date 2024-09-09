<script setup>
import { ref, onMounted,onActivated, computed,watch } from "vue";
import { useRouter } from 'vue-router'
import FileService from '../service/FileService';
import { checker, bitUnit, openFile, isMirror } from '@/utils/file';
import { useConfirm } from "primevue/useconfirm";
import { useStore } from 'vuex';
import { platform } from '@/utils/platform';
import { copy } from '@/utils/clipboard';
import { merge } from '@/service/common/request';
import { useToast } from "primevue/usetoast";
import _ from "lodash";
const toast = useToast();
const store = useStore();
const confirm = useConfirm();
const router = useRouter();
const fileService = new FileService();
const scopeType = ref('All');
const portMap = ref({});

const props = defineProps(['small','files','error','loading','loader','queueSize','endpoints'])
const emits = defineEmits(['download','upload','load'])
const info = computed(() => {
	return store.getters['app/info']
});

const fileData = ref([]);

const attrLoading = ref(false);
const detailData = ref({});
const loadFileAttr = (item, unload, detailload) => {
	if(!unload){
		attrLoading.value = true;
	}
	const _joinPath = [];
	const _pre = item?.path || current.value?.path;
	if(!!_pre){
		_joinPath.push(_pre)
	}
	_joinPath.push(item.name);
	fileService.getFiles(_joinPath.join("/")).then((res)=>{
		const _res = res;
		if(!_res.access){
			_res.access = {
				all: null,
				users:{}
			}
			if(!_res.access.users){
				_res.access.users = {};
			}
		}
		attrLoading.value = false;
		if(detailload){
			detailData.value[res.path] = {
				...item,
				..._res,
			}
		} else {
			selectedFile.value = {
				...item,
				..._res,
			}
		}
		if(!!res.downloading || !!res.uploading){
			setTimeout(()=>{
				loadFileAttr(item, true);
			},1000)
		}
	})
}
const formatFile = (path, d, ary, pre) => {
		d.forEach((file,idx)=>{
			const _file = {
				key:`${pre}${idx}`,
				name:file,
				path:`${path}`,
				loading:false,
				selected: false,
				ext:file.charAt(file.length-1) == "/"?"/":file.split(".")[file.split(".").length-1]
			}
			if(_file.ext == "/"){
				_file.children = [];
				_file.leaf = false;
				ary.push(_file);
			} else {
				ary.push(_file);
				loadFileAttr(_file, true, true);
			}
		})
}

const current = ref({
	path:'',
	name:''
});

watch(()=>props.files,()=>{
	fileData.value = [];
	if(!!props.files && props.files.length>0){
		formatFile(current.value.path, props.files, fileData.value,'');
	}
},{
	deep:true,
	immediate:true,
});

const filesFilter = computed(() => {
	let rtn = fileData.value.filter((file)=>{
		return (typing.value == '' || file.name.indexOf(typing.value)>=0 ) 
	});
	if(!!sortField.value && (sortOrder.value ==1 || sortOrder.value==-1)){
		if(['state'].includes(sortField.value)){
			rtn.sort((a,b)=>{
				const va = detailData.value[`/${a.path}/${a.name}`]?detailData.value[`/${a.path}/${a.name}`][sortField.value]:'';
				const vb = detailData.value[`/${b.path}/${b.name}`]?detailData.value[`/${b.path}/${b.name}`][sortField.value]:'';
				return vb.localeCompare(va) * sortOrder.value
			})
		} else if(['time','size'].includes(sortField.value)){
			rtn.sort((a,b)=>{
				const va = detailData.value[`/${a.path}/${a.name}`]?detailData.value[`/${a.path}/${a.name}`][sortField.value]:0;
				const vb = detailData.value[`/${b.path}/${b.name}`]?detailData.value[`/${b.path}/${b.name}`][sortField.value]:0;
				return (va-vb) * sortOrder.value
			})
		} else {
			rtn.sort((a,b)=>{
				const va = a[sortField.value]||'';
				const vb = b[sortField.value]||'';
				return vb.localeCompare(va) * sortOrder.value
			})
		}
	}
	return rtn
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
	return 'Empty.'
});

const fileLoading = ref({})
const onNodeExpand = (node) => {
	if (node.ext == "/") {
		node.loading = true;
		node.children = []
		let nextPath = '';
		if(!!node.path){
			nextPath = `${node.path}/${node.name.split("/")[0]}`
		} else {
			nextPath = node.name.split("/")[0];
		}
		fileService.getFiles(nextPath).then((res)=>{
			formatFile(nextPath,res,node.children,`${node.key}-`);
			node.loading = false;
		})
	}
};

const home = ref({ type: 'home',icon: 'pi pi-angle-left' });
const itemsBreadcrumb = ref([]);
const load = () => {
	emits('load',current.value?.path)
}
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
	if(item == 0){
		current.value = {
			path:'',
			name:''
		}
		itemsBreadcrumb.value = [];
	} else if(item == -1){
		current.value = {
			...itemsBreadcrumb.value[itemsBreadcrumb.value.length -1]
		}
		itemsBreadcrumb.value.splice(itemsBreadcrumb.value.length-1,1);
	} else if(item.index+1 < itemsBreadcrumb.value.length){
		current.value = {
			...item
		}
		itemsBreadcrumb.value.splice(item.index,itemsBreadcrumb.value.length-item.index);
	}
	load();
}
const selectedFile = ref();
const selectFile = (e, item) => {
	if(item.ext == "/"){
		const _name = item.name.split("/")[0];
		if(!!current.value?.path){
			itemsBreadcrumb.value.push({
				...current.value,
				index:itemsBreadcrumb.value.length-1
			});
			current.value = {
				path:`${current.value.path}/${_name}`,
				name:_name
			}
		}else {
			current.value = {
				path:`${_name}`,
				name:_name
			}
		}
		
		load();
	} else if(!item.selected) {
		item.selected = { time:new Date(),value:true };
		selectedFile.value = null;
	} else if(!!item.selected) {
		const diff = Math.abs((new Date()).getTime() - item.selected.time.getTime());
			if(diff <= 600){
				item.selected.time = new Date();
				if(!!hasTauri.value){
					openFile(`${localDir.value}/${selectedFile.value?.path}`)
				}
			} else {
				item.selected.value = !item.selected.value;
				item.selected.time = new Date();
				selectedFile.value = null;
			}
		
		//openFile(`${localDir.value}/${current.value.path}`)
	}
}

const handleLongTap = (item) => () => {
	loadFileAttr(item);
	showAtionMenu();
}
const actions = computed(()=>{
	 
	if(selectedFile.value?.ext == "/"){
		return [
			{
					label: 'Path',
					shortcut: selectedFile.value?.path,
					command: () => {
					}
			}
		]
		
	}else{
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
					shortcut: !!selectedFile.value?.time?new Date(selectedFile.value.time).toLocaleString():'-',
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
	}
})
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
const localDir = ref("");
const mirrorPaths = ref([])
const config = ref({
	localDir: "",
	mirrorPaths: []
})
const saveConfig = () => {
	fileService.setConfig(info.value?.endpoint?.id, config.value).then(()=>{
		toast.add({ severity: 'success', summary:'Tips', detail: 'Save successfully.', life: 3000 });
		getConfig();
	})
}
const selectDir = (dir) => {
	if(!!dir){
		config.value.localDir = dir;
	}
}
const copyDir = () => {
	copy(localDir.value)
}

const hasTauri = ref(!!window.__TAURI_INTERNALS__ || true);
const getConfig = () => {
	fileService.getConfig(info.value?.endpoint?.id).then((res)=>{
		config.value = res;
		localDir.value = config.value.localDir;
		mirrorPaths.value = config.value.mirrorPaths;
		if(config.value.localDir == '~/ztmCloud' && !!hasTauri.value){
			fileService.getDir().then((dir)=>{
				config.value.localDir = `${dir}/ztmCloud`;
				fileService.setConfig(info.value?.endpoint?.id, config.value).then(()=>{
					getConfig();
				})
			})
		}else{
			load();
		}
	})
}

const openQueue = () => {
	emits('download',[])
	emits('upload',[])
}
const doDownload = (item) => {
	if(item.path){
		fileService.download(item.path).then((res)=>{
			toast.add({ severity: 'contrast', summary:'Tips', detail: `${item.name} in the download queue.`, life: 3000 });
			emits('download',[item]);
			loadFileAttr(item, true);
		})
	}
}
const doDownloads = () => {
	const reqs = [];
	if(selectedFiles.value.length>0){
		const downloadFiles = []
		selectedFiles.value.forEach((item)=>{
			if(item.state != "new"){
				downloadFiles.push(item);
				reqs.push(fileService.download(item.path));
			}
		})
	}
	if(reqs.length>0){
		merge(reqs).then((allRes) => {
			toast.add({ severity: 'contrast', summary:'Tips', detail: `${downloadFiles.length} files in the download queue.`, life: 3000 });
			emits('download',downloadFiles)
		})
	}
}

const doUpload = (item) => {
	if(item.path){
		fileService.upload(item.path).then((res)=>{
			toast.add({ severity: 'contrast', summary:'Tips', detail: `${item.name} in the upload queue.`, life: 3000 });
			emits('upload',[item]);
			loadFileAttr(item, true);
		})
	}
}
const doUploads = () => {
	const reqs = [];
	if(selectedFiles.value.length>0){
		const uploadFiles = [];
		selectedFiles.value.forEach((item)=>{
			if(item.state == "new" || item.state == "changed"){
				uploadFiles.push(item);
				reqs.push(fileService.upload(item.path));
			}
		})
	}
	if(reqs.length>0){
		merge(reqs).then((allRes) => {
			toast.add({ severity: 'contrast', summary:'Tips', detail: `${uploadFiles.length} files in the upload queue.`, life: 3000 });
			emits('upload',uploadFiles)
		})
	}
}
const fileIcon = computed(()=>(name, path)=>{
	return checker(name, path, mirrorPaths.value)
})
const toggleMirror = () => {
	
	const _index = isMirror(current.value.path, mirrorPaths.value);
	if(_index>-1){
		mirrorPaths.value.splice(_index,1);
	} else {
		mirrorPaths.value.push(`/${current.value.path}`)
	}
	saveConfig();
}
const moreMenu = ref();
const moreItems = computed(()=>{
	
	const actions = [
		{
				label: 'Back Root',
				command(){
					changePath(0)
				}
		}
	];
	if(isMirror(current.value.path, mirrorPaths.value)>-1){
		actions.push({
				label: 'Remove Mirror',
				command(){
					toggleMirror()
				}
		})
	}else{
		actions.push({
				label: 'Set Mirror',
				command(){
					toggleMirror()
				}
		})
	}
	if(!!hasTauri.value){
		actions.push({
				label: 'Open Folder',
				command(){
					openFile(`${localDir.value}/${current.value.path}`)
				}
		})
	}
	if(selectedFiles.value.length>1){
		actions.push({
			label: 'Download',
			command(){
				doDownloads()
			}
		});
		actions.push({
			label: 'Upload',
			command(){
				doUploads()
			}
		});
	}
	return actions
});

const moreToggle = (event) => {
    moreMenu.value.toggle(event);
};
const stateColor = ref({
	new:'warn',
	changed:'warn',
	synced:'success',
	missing: 'secondary',
	outdated: 'secondary'
})
const sortField = ref();
const sortOrder = ref();
const searchSort = (e)=>{
	if(e){
		sortField.value = e.sortField;
		sortOrder.value = e.sortOrder;
	}
}
const filterEps = computed(()=>(users)=>{
	const usernames = Object.keys(users);
	usernames.push(info.endpoint?.username);
	return _.filter(props.endpoints, (item) => !_.includes(usernames, item.username));
})
const acl = ref({
	user:'',
	permission: 'readonly'
})
const addUser = () => {
	selectedFile.value.access.users[acl.value.user] = acl.value.permission;
	acl.value = {
		user:'',
		permission: 'readonly'
	};
}
const delUser = (key) => {
	delete selectedFile.value.access.users[key];
}
const active = ref(0);
const aclLoading = ref(false);
const saveAcl = () => {
	aclLoading.value = true;
	fileService.setAcl(selectFile.value?.access || {}).then((res)=>{
		aclLoading.value = false;
	})
}
const isReadonly = computed(()=>(_file)=>{
	const usernames = _file?.access?.users || {};
	if(usernames[info.value?.endpoint?.username] == 'readonly'){
		return true;
	} else if(_file?.access?.all == 'readonly' && usernames[info.value?.endpoint?.username] != 'writable'){
		return true;
	} else {
		return false;
	}
})
onMounted(()=>{
	getConfig();
	
})
</script>

<template>
	<div class="flex flex-row min-h-screen h-full" :class="{'embed-ep-header':false}">
		<div  class="relative h-full w-full" >
			<AppHeader :child="true">
					<template #start>
						
						<Button v-if="showBack" @click="back" icon="pi pi-times" severity="secondary" text />
						<span v-if="showBack" class="opacity-40 mx-2">/</span>
						<Button @click="openSetting()" v-tooltip="'Setting'" icon="pi pi-cog" severity="secondary" text aria-haspopup="true" aria-controls="op"/>
						<span v-if="!isMobile" class="opacity-40 mx-2">/</span>
						<Button v-if="!isMobile" @click="changePath(0)" v-tooltip="`Root:${localDir}`" icon="pi pi-warehouse" severity="secondary" text />
						<span v-if="!!current.name" class="opacity-40 mx-2">/</span>
						<Button v-if="!!current.name" @click="changePath(-1)" v-tooltip="`../`" icon="pi pi-arrow-left" severity="secondary" text />
						<span class="opacity-40 mx-2" v-if="itemsBreadcrumb.length>0 && !isMobile">/</span>
						<Breadcrumb v-if="itemsBreadcrumb.length>0 && !isMobile" :model="itemsBreadcrumb">
								<template #item="{ item }">
									<Button v-if="item.icon" @click="changePath(item)" v-tooltip="item.name" :icon="item.icon" severity="secondary" text />
									<Button v-else @click="changePath(item)" :label="item.name" severity="secondary" text />
								</template>
								<template #separator> / </template>
						</Breadcrumb>
						<span v-if="!!current.name && !isMobile" class="opacity-40 mx-2">/</span>
						<Button v-if="!!current.name && !isMobile" class="font-bold" @click="load" v-tooltip="current.path" :label="current.name" severity="primary" text />
						
					</template>
					<template #center>
						<!-- <b>Files</b> -->
					</template>
					<template #end> 
						<Button v-if="!isMobile" @click="toggleMirror()" v-tooltip.bottom="isMirror(current.path, mirrorPaths)>-1?'Remove Mirror':'Set Mirror'" :icon="isMirror(current.path, mirrorPaths)>-1?'pi pi-sync pi-spin':'pi pi-sync'" :severity="isMirror(current.path, mirrorPaths)>-1?'primary':'secondary'" text />
						<Button v-if="hasTauri && !isMobile" @click="openFile(`${localDir}/${current.path}`)" v-tooltip.bottom="'Open folder'" icon="pi pi-folder-open" severity="secondary" text />
						<FileImportSelector icon="pi pi-plus" v-if="hasTauri && current.path!='' && current.path!='users'" :path="`${localDir}/${current.path}`" class="pointer ml-2" placeholder="Import" @saved="load"></FileImportSelector>
						<!-- <Button v-if="!isMobile" icon="pi pi-refresh" text @click="load"  :loading="loader"/> -->
						<Button @click="openQueue" :severity="!props.queueSize?'secondary':'primary'">
							<i :class="!props.queueSize?'pi pi-inbox':'pi pi-spinner pi-spin'"/>
							<Badge v-if="!!props.queueSize" :value="props.queueSize" size="small"></Badge>
						</Button>
						<Button icon="pi pi-ellipsis-v" @click="moreToggle" :severity="'secondary'" aria-haspopup="true" aria-controls="more_menu">
						</Button>
					</template>
			</AppHeader>
			<Menu ref="moreMenu" id="more_menu" :model="moreItems" :popup="true" />
			<Popover ref="op" >
				<div class="flex w-full pt-4">
					<FloatLabel>
						<label>Local Dir</label>
						<InputText  id="LocalDir" size="small" v-model="config.localDir"  class="flex-item"></InputText>
					</FloatLabel>
					<Button v-tooltip="'Copy'" size="small" :disabled="!localDir" icon="pi pi-copy" class="ml-2"  @click="copyDir"></Button>
					<FileFolderSelector v-if="hasTauri" :path="localDir" class="pointer ml-2" placeholder="Choose" @select="selectDir"></FileFolderSelector>
				</div>
				<!-- <div class="flex w-full">
					<InputList
						class="w-full mt-5"
						itemClass="input_pannel"
						:d="config.mirrorPaths"
						:min="1"
						:attrs="''"
					>
						<template #default="{ item, listIndex }">
							
								<FloatLabel :class="listIndex != (config.mirrorPaths.length-1) ?'mb-4':''">
									<label>{{`Mirror Path ${listIndex+1}`}}</label>
									<InputText size="small" v-model="config.mirrorPaths[listIndex]"  class="flex-item"></InputText>
								</FloatLabel>
						</template>
					</InputList>
				</div> -->
				<div class="flex w-full mt-3">
					<Button class="w-full" label="Apply" size="small" :disabled="!config.localDir" icon="pi pi-check" @click="saveConfig"></Button>
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
				<TreeTable @sort="searchSort" v-if="layout == 'list'" @node-expand="onNodeExpand" loadingMode="icon" class="w-full file-block" :value="filesFilter" >
						<Column sortable field="name" header="Name" expander style="width: 50%">
								<template  #body="slotProps">
									<div class="selector pointer"  v-longtap="handleLongTap(file)" @click="selectFile($event,slotProps.node)" :class="{'active':!!slotProps.node.selected?.value,'px-2':!!slotProps.node.selected?.value,'py-1':!!slotProps.node.selected?.value}" >
										<img :src="fileIcon(slotProps.node.name,slotProps.node.path)" class="relative vertical-align-middle" width="20" style="top: -1px; overflow: hidden;margin: auto;"/>
										<b class="px-2 vertical-align-middle"><i v-if="isReadonly(slotProps.node)" class="pi pi-lock opacity-70" style="font-size: 8pt;"  /> {{ slotProps.node.name }}</b>
									</div>
								</template>
						</Column>
						<Column field="state" header="State"  sortable>
								<template  #body="slotProps">
									<Tag :severity="stateColor[detailData[`/${slotProps.node.path}/${slotProps.node.name}`].state]" class="py-0 px-1" v-if="!!detailData[`/${slotProps.node.path}/${slotProps.node.name}`]">{{ detailData[`/${slotProps.node.path}/${slotProps.node.name}`].state }}</Tag>
								</template>
						</Column>
						<Column field="size" header="Size"  sortable>
							<template  #body="slotProps">
								<div class="text-sm opacity-60" v-if="detailData[`/${slotProps.node.path}/${slotProps.node.name}`]?.size">{{bitUnit(detailData[`/${slotProps.node.path}/${slotProps.node.name}`].size)}}</div>
							</template>
						</Column>
						<Column v-if="!isMobile" field="time" header="Time" style="min-width: 12rem" sortable>
							<template  #body="slotProps">
								<div class="text-sm opacity-60" v-if="detailData[`/${slotProps.node.path}/${slotProps.node.name}`]?.time">
									{{new Date(detailData[`/${slotProps.node.path}/${slotProps.node.name}`].time).toLocaleString()}}
								</div>
							</template>
						</Column>
						
				</TreeTable>
				<div v-else class="grid text-left px-3 m-0 pt-1" v-if="filesFilter && filesFilter.length >0">
						<div :class="props.small?'col-4 md:col-4 xl:col-2':'col-4 md:col-2 xl:col-1'" class="relative text-center file-block" v-for="(file,hid) in filesFilter" :key="hid">
							<div class="selector p-2 relative" v-longtap="handleLongTap(file)" @click="selectFile($event,file)" :class="{'active':!!file.selected?.value}" >
								<img :src="fileIcon(file.name,current.path)" class="pointer" height="40"  style="border-radius: 4px; overflow: hidden;margin: auto;"/>
								
								<ProgressSpinner v-if="file.loading" class="absolute opacity-60" style="width: 30px; height: 30px;margin-left: -35px;margin-top: 5px;" strokeWidth="10" fill="#000"
										animationDuration="2s" aria-label="Progress" />
								<div class="mt-1" v-tooltip="file">
									<b v-tooltip="file.name" class="multiline-ellipsis">
										<!-- <i v-if="app.uninstall" class="pi pi-cloud-download mr-1" /> -->
										<i v-if="isReadonly(file)" class="pi pi-lock opacity-70" style="font-size: 8pt;"  /> {{ file.name }}
									</b>
								</div>
								<Tag :severity="stateColor[detailData[`/${file.path}/${file.name}`].state]" class="py-0 px-1 mt-2" v-if="!!detailData[`/${file.path}/${file.name}`]">{{ detailData[`/${file.path}/${file.name}`].state }}</Tag>
								<div class="text-sm opacity-60 mt-1" v-if="detailData[`/${file.path}/${file.name}`]">{{bitUnit(detailData[`/${file.path}/${file.name}`].size)}}</div>
								
							</div>
					 </div>
				</div>
				<Dialog class="nopd noheader transparentMask" v-model:visible="visible" modal :dismissableMask="true" :draggable="true" >
					<Button v-if="active == 1" :loading="aclLoading" class="absolute" style="right: 8px;z-index: 2;top: 8px;" @click="saveAcl" icon="pi pi-check" />
					<Loading v-if="attrLoading" />
					<TabView v-else v-model:activeIndex="active">
						<TabPanel>
							<template #header>
								<div>
									<i class="pi pi-info-circle mr-2" />Info
								</div>
							</template>
							<Menu :model="actions" class="w-60">
							    <template #start>
										<div v-if="selectedFile" class="text-center pt-4 relative">
											<img :src="fileIcon(selectedFile.name)" class="pointer" width="40" height="40" style="border-radius: 4px; overflow: hidden;margin: auto;"/>
											<div class="px-2 ">
												<Button style="word-break: break-all;" class="max-w-16rem" @click="copyFile" iconPos="right" icon="pi pi-copy" plain :label="selectedFile.name" text />
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
														<Tag :severity="stateColor[item.shortcut]" v-if="item.label == 'State'">{{ item.shortcut }}</Tag>
														<span v-else>{{ item.shortcut }}</span>
													</span>
							        </a>
							    </template>
							    <template #end >
										<div class="px-4 pt-2 pb-1" v-if="selectedFile?.uploading">
												<ProgressBar :value="selectedFile.uploading*100"></ProgressBar>
										</div>
										<div class="px-4 pt-2 pb-1" v-if="selectedFile?.downloading">
												<ProgressBar :value="selectedFile.downloading*100"></ProgressBar>
										</div>
										<div class="px-3 pt-2 pb-3 flex justify-content-between">
											<div  class="flex-item px-2" v-if="selectedFile?.ext != '/' && (selectedFile?.state == 'new' || selectedFile?.state == 'changed' || selectedFile?.state == 'synced')">
												<Button :disabled="!selectedFile?.path" @click="doUpload(selectedFile)" class="w-full" icon="pi pi-cloud-upload" label="Upload" severity="secondary" />
											</div>
											<div  class="flex-item px-2" v-if="selectedFile?.ext != '/' && selectedFile?.state != 'new'">
												<Button :disabled="!selectedFile?.path" @click="doDownload(selectedFile)" class="w-full" icon="pi pi-cloud-download" label="Download" severity="secondary"  />
											</div>
											<div  class="flex-item px-2" v-if="selectedFile?.state != 'missing'">
												<Button :disabled="!selectedFile?.path" @click="openFile(`${localDir}${selectedFile?.path}`)" class="w-full" icon="pi pi-external-link" label="Open" severity="secondary"  />
											</div>
																
										</div>
							    </template>
							</Menu>
						</TabPanel>
						<TabPanel v-if="selectedFile?.access && selectedFile?.state != 'new'">
							<template #header>
								<div>
									<i class="pi pi-shield mr-2" />ACL
								</div>
							</template>
							<div class="p-3">
								<div class="py-2">
									<b>All permission:</b>
								</div>
								<SelectButton class="w-full" v-model="selectedFile.access.all" :options="[{name:'Inherit',id:null},{name:'Readonly',id:'readonly'},{name:'Block',id:'block'}]" optionLabel="name" optionValue="id" aria-labelledby="basic" />
								<div class="pt-4 pb-2">
									<b>Users permission:</b>
								</div>
								<Listbox v-if="selectedFile.access?.users" :options="Object.keys(selectedFile.access.users)" class="w-full md:w-56" listStyle="max-height:250px">
									<template #option="slotProps">
											<div class="flex w-full">
												<div class="flex-item pt-1">
													<Avatar icon="pi pi-user" size="small" style="background-color: #ece9fc; color: #2a1261" />
													<span class="ml-2">{{slotProps.option}}</span>
												</div>
												<div>
													<Select size="small" class="w-full small"  v-model="selectedFile.access.users[slotProps.option]" :options="[{name:'Readonly',id:'readonly'},{name:'Block',id:'block'}]" optionLabel="name" optionValue="id" placeholder="Permission"/>
												</div>
											<div class="pl-1">
												<Button @click="delUser(slotProps.option)" icon="pi pi-minus" severity="secondary" />
											</div>
											</div>
									</template>
									<template #empty>
										---
									</template>
									<template #footer>
										<div class="flex items-center pt-1 pb-2 px-3">
											<div class="flex-item pr-1">
												<Select size="small" class="w-full"  v-model="acl.user" :options="filterEps(selectedFile.access.users)" optionLabel="username" optionValue="username" :filter="filterEps(selectedFile.access.users).length>8" placeholder="Endpoint"/>
											</div>
											<div class="flex-item">
												<Select size="small" class="w-full"  v-model="acl.permission" :options="[{name:'Readonly',id:'readonly'},{name:'Block',id:'block'}]" optionLabel="name" optionValue="id" placeholder="Permission"/>
											</div>
											<div class="pl-1">
												<Button :disabled="!acl.user" @click="addUser" icon="pi pi-plus" severity="secondary" />
											</div>
										</div>
									</template>
								</Listbox>
							</div>
						</TabPanel>
					</TabView>
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