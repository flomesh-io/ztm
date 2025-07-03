<script setup>
import { ref, onMounted,onActivated, computed,watch } from "vue";
import { useRouter } from 'vue-router'
import FileService from '../service/FileService';
import { checker, bitUnit, openFile, isImage, writeMobileFile,labels, colors,icons } from '@/utils/file';
import { useConfirm } from "primevue/useconfirm";
import { useStore } from 'vuex';
import { isPC } from '@/utils/platform';
import { copy } from '@/utils/clipboard';
import { merge } from '@/service/common/request';
import { useToast } from "primevue/usetoast";
import Config from './Config.vue'
import _ from "lodash";
import { useI18n } from 'vue-i18n';
import { isMobileWidth } from '@/utils/platform';
const { t } = useI18n();
const toast = useToast();
const store = useStore();
const confirm = useConfirm();
const router = useRouter();
const fileService = new FileService();
const scopeType = ref('All');
const portMap = ref({});

const props = defineProps(['small','files','loading','queueSize'])
const emits = defineEmits(['download','upload','load','preview'])
const info = computed(() => {
	return store.getters['app/info']
});
const fileConfig = ref();
const fileData = ref([]);
const current = ref({
	path:'/',
	name:''
});
const isMyFolder = computed(()=>{
	const pathAry = current.value.path.split("/");
	return pathAry[2] == info.value?.username
})
const attrLoading = ref(false);
const detailData = ref({});
const typing = ref('');
const actionMenu = ref();
const showAtionMenu = (e) => {
	fileConfig.value.open(e);
};
const layout = ref('grid');
const isMobile = computed(isMobileWidth);

const emptyMsg = computed(()=>{
	return t('Empty.')
});
const fullPath = computed(()=>(item)=>{
	if(item?.path){
		return item.path;
	} else {
		const _joinPath = [];
		const _pre = current.value?.path;
		if(!!_pre){
			_joinPath.push(_pre)
		}
		if(item?.name){
			_joinPath.push(item.name);
		}
		return _joinPath.join("/");
	}
})
const mirrors = ref({})
const getMirrors = () => {
	fileService.getMirror('', info.value?.endpoint?.id).then((res)=>{
		mirrors.value = res;
	})
}
const loadFileAttr = (unload, detailItem) => {
	if(!unload){
		attrLoading.value = true;
	}
	let targetItem = detailItem || selectedFile.value;
	fileService.getFiles(fullPath.value(targetItem)).then((res)=>{
		const _res = res;
		if(!_res.access){
			_res.access = {}
		}
		if(!!_res.access){
			if(!_res.access.all){
				_res.access.all = null;
			}
			if(!_res.access.users){
				_res.access.users = {};
			}
		}
		attrLoading.value = false;
		if(_res.path == selectedFile.value?.path){
			selectedFile.value = {
				...selectedFile.value,
				..._res,
				downloading:_res?.downloading
			}
		} 
		detailData.value[res.path] = {
			...detailData.value[res.path],
			..._res,
			downloading:_res?.downloading
		}
		if(res?.downloading!=null){
			setTimeout(()=>{
				loadFileAttr(true, targetItem);
			},1000)
		}
	}).catch((e)=>{
		attrLoading.value = false;
		if(!detailItem){
			selectedFile.value = {
				...selectedFile.value,
				error:e,
				downloading:null
			}
		} 
		
		detailData.value[targetItem.path] = {
			...detailData.value[targetItem.path],
			error:e,
			downloading:null
		}
	})
}
const formatFile = (path, d, ary, pre) => {
		d.forEach((file,idx)=>{
			const fileName = file.charAt(file.length-1) == "/"?file.substring(0,file.length-1):file;
			const _file = {
				key:`${pre}${idx}`,
				name:file,
				path:`${path}/${fileName}`,
				fileUrl: file.charAt(file.length-1) == "/"?'':fileService.getFileMetaUrl(`${path}/${file}`),
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
				loadFileAttr(true, _file);
			}
		})
}


const filesFilter = computed(() => {
	let rtn = fileData.value.filter((file)=>{
		return (typing.value == '' || file.name.indexOf(typing.value)>=0 ) 
	});
	if(!!sortField.value && (sortOrder.value ==1 || sortOrder.value==-1)){
		
		//`/${a.path}/${a.name}`
		if(['state'].includes(sortField.value)){
			rtn.sort((a,b)=>{
				const va = detailData.value[a.path]?detailData.value[a.path][sortField.value]:'';
				const vb = detailData.value[b.path]?detailData.value[b.path][sortField.value]:'';
				return vb.localeCompare(va) * sortOrder.value
			})
		} else if(['time','size'].includes(sortField.value)){
			rtn.sort((a,b)=>{
				const va = detailData.value[a.path]?detailData.value[a.path][sortField.value]:0;
				const vb = detailData.value[b.path]?detailData.value[b.path][sortField.value]:0;
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

const fileLoading = ref({})
const onNodeExpand = (node) => {
	if (node.ext == "/") {
		node.loading = true;
		node.children = []
		let nextPath = `${node?.path||''}/${node.name.split("/")[0]}`
		fileService.getFiles(nextPath).then((res)=>{
			formatFile(nextPath,res?.list||[],node.children,`${node.key}-`);
			node.loading = false;
		})
	}
};

const openPreview = (item) => {
	emits('preview',{item, localDir: localDir.value});
	
	fileConfig.value.close();
}
const hasPC = computed(()=> isPC())
const openPreviewFile = (item) => {
	
	if(!detailData.value[item.path]?.error){
		if(hasPC.value && detailData.value[item.path]?.state != 'missing'){
			openFile(`${localDir.value}${item?.path}`);
		} else if(detailData.value[item.path]?.state != 'new') {
			openPreview(item);
		}
	}
}
const home = ref({ type: 'home',icon: 'pi pi-angle-left' });
const itemsBreadcrumb = ref([]);
const load = (unload) => {
	emits('load',{
		path:current.value?.path,
		unload
	});
	getMirrors();
}
const back = () => {
	if(window.parent){
		window.parent.location.href="/#/mesh/apps";
	}else{
		location.href="/#/mesh/apps";
	}
}
const showBack = computed(()=>{
	return !hasPC.value;
})
const changePath = (item) => {
	if(item == 0 || (item == -1 && itemsBreadcrumb.value.length <= 0)){
		current.value = {
			path:'/',
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
const longtapblock = ref(0);
const selectFile = (e, item) => {
	if(longtapblock.value>0){
		longtapblock.value--;
		return;
	}
	if(item.ext == "/"){
		const _name = item.name.split("/")[0];
		if(!!current.value?.path && current.value?.path!='/'){
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
				path:`/${_name}`,
				name:_name
			}
		}
		load();
	} else if(!item.selected) {
		item.selected = { time:new Date(),value:true };
		// selectedFile.value = null;
	} else if(!!item.selected) {
		const diff = Math.abs((new Date()).getTime() - item.selected.time.getTime());
			if(diff <= 600){
				item.selected.time = new Date();
				openPreviewFile(item);
			} else {
				item.selected.value = !item.selected.value;
				item.selected.time = new Date();
				// selectedFile.value = null;
			}
		
		//openFile(`${localDir.value}${current.value.path}`)
	}
}

const handleLongTap = (item) => (e) => {
	longtapblock.value++;
	selectedFile.value = item;
	loadFileAttr();
	showAtionMenu(e);
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
// const mirrorPaths = ref([])
const config = ref({
	localDir: "",
	// mirrorPaths: []
})
const saveConfig = () => {
	fileService.setConfig(info.value?.endpoint?.id, config.value).then(()=>{
		toast.add({ severity: 'success', summary:t('Tips'), detail: t('Save successfully.'), life: 3000 });
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

const hasTauri = ref(!!window.__TAURI_INTERNALS__);
const getConfig = () => {
	fileService.getConfig(info.value?.endpoint?.id).then((res)=>{
		config.value = res;
		localDir.value = config.value.localDir;
		// mirrorPaths.value = config.value.mirrorPaths;
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
	// writeMobileFile('doDownloadStart.txt',item?.path||'');
	if(item.path){
		fileService.download(item.path).then((res)=>{
			// writeMobileFile('doDownloadSuccess.txt',res?.toString()||'');
			toast.add({ severity: 'contrast', summary:t('Tips'), detail: `${item.name} ${t('in the download queue.')}`, life: 3000 });
			emits('download',[item]);
			selectedFile.value = item;
			loadFileAttr(true);
		})
		.catch(err => {
			writeMobileFile('doDownloadError.txt',error?.message);
			emits('download',[item]);
			selectedFile.value = item;
			loadFileAttr(true);
		}); 
	}
}
const doCancelDownload = (item) => {
	emits('download',[]);
	selectedFile.value = item;
	loadFileAttr(true);
}
const doDownloads = () => {
	const reqs = [];
	if(selectedFiles.value.length>0){
		const downloadFiles = []
		selectedFiles.value.forEach((item)=>{
			if(detailData.value[item.path].state != "new" && !detailData.value[item.path].error){
				downloadFiles.push(item);
				reqs.push(fileService.download(item.path));
			}
		})
	}
	if(reqs.length>0){
		merge(reqs).then((allRes) => {
			toast.add({ severity: 'contrast', summary:t('Tips'), detail: `${downloadFiles.length} ${t('files in the download queue.')}`, life: 3000 });
			emits('download',downloadFiles)
		})
		.catch(err => {
			emits('download',downloadFiles);
		}); 
	}
}

const doRemove = (item) => {
	loadFileAttr(true, item);
	load(true);
}
const doUpload = (item) => {
	if(item.path){
		item.uploading = true;
		fileService.upload(item.path).then((res)=>{
			toast.add({ severity: 'contrast', summary:t('Tips'), detail: `${item.name} ${t('in the upload queue.')}`, life: 3000 });
			emits('upload',[item]);
			selectedFile.value = item;
			setTimeout(()=>{
				item.uploading = false;
				loadFileAttr(true);
			},1500)
		})
		.catch(err => {
			emits('upload',[item]);
			item.uploading = false;
			selectedFile.value = item;
			loadFileAttr(true);
		}); 
	}
}
const doUploads = () => {
	const reqs = [];
	if(selectedFiles.value.length>0){
		const uploadFiles = [];
		selectedFiles.value.forEach((item)=>{
			if(detailData.value[item.path].state == "new" || detailData.value[item.path].state == "changed"){
				uploadFiles.push(item);
				reqs.push(fileService.upload(item.path));
			}
		})
	}
	if(reqs.length>0){
		merge(reqs).then((allRes) => {
			toast.add({ severity: 'contrast', summary:t('Tips'), detail: `${uploadFiles.length} ${t('files in the upload queue.')}`, life: 3000 });
			emits('upload',uploadFiles)
		})
		.catch(err => {
			emits('upload',uploadFiles);
		}); 
	}
}
const fileIcon = computed(()=> (item) => icons(
		detailData.value[item?.path]? {
			...item,
			...detailData.value[item.path],
			isMirror:mirrors.value[item?.path]?.download || mirrors.value[item?.path]?.upload
		}:{
			...item,
			isMirror:mirrors.value[item?.path]?.download || mirrors.value[item?.path]?.upload
		}
	)
)

const moreMenu = ref();
const moreItems = computed(()=>{
	
	const actions = [];
	if(isMobile.value){
		actions.push({
				label: t('Home'),
				command(){
					changePath(0)
				}
		})
	}
	if(!!hasTauri.value){
		actions.push({
				label: t('Open Folder'),
				command(){
					openFile(`${localDir.value}${current.value.path}`)
				}
		})
	}
	if(selectedFiles.value.length>1){
		actions.push({
			label: t('Download'),
			command(){
				doDownloads()
			}
		});
		actions.push({
			label: t('Upload'),
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
const sortField = ref();
const sortOrder = ref();
const searchSort = (e)=>{
	if(e){
		sortField.value = e.sortField;
		sortOrder.value = e.sortOrder;
	}
}
const addUser = (acl) => {
	selectedFile.value.access.users[acl.user] = acl.permission;
}
const delUser = (key) => {
	delete selectedFile.value.access.users[key];
}
const perIcon = computed(()=>(_file)=>{
	const detailFile = detailData.value[_file.path];
	const usernames = detailFile?.access?.users || {};
	if(usernames[info.value?.username] == 'readonly'){
		return 'pi pi-eye opacity-70';
	} else if(detailFile?.access?.all == 'readonly'){
		return 'pi pi-eye opacity-70';
	} else if(detailFile?.access?.all == 'block'){
		return 'pi pi-lock opacity-70';
	} else {
		return false;
	}
})
const stateColor = ref(colors);
const stateLabel = computed(()=>(item)=>labels(item, true))
watch(()=>props.files,()=>{
	fileData.value = [];
	if(!!props.files && props.files.length>0){
		formatFile(current.value.path=="/"?"":current.value.path, props.files, fileData.value,'');
	}
},{
	deep:true,
	immediate:true,
});
onMounted(()=>{
	getConfig();
	
})
</script>

<template>
	<div class="flex flex-row min-h-screen h-full" :class="{'embed-ep-header':false}">
		<div  class="relative h-full w-full min-h-screen" >
			<AppHeader :child="true">
					<template #start>
						
						<Button v-if="showBack" @click="back" icon="pi pi-times" severity="secondary" text />
						<span v-if="showBack" class="opacity-40 mx-2">/</span>
						<Button v-if="!isMobile" @click="openSetting()" v-tooltip="t('Setting')" icon="pi pi-cog" severity="secondary" text aria-haspopup="true" aria-controls="op"/>
						<span v-if="!isMobile" class="opacity-40 mx-2">/</span>
						<Button @click="changePath(0)" v-tooltip="`Root:${localDir}`" icon="pi pi-warehouse" severity="secondary" text />
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
						<Button v-if="!isMobile" @click="load()" :icon="loading?'pi pi-refresh pi-spin':'pi pi-refresh'" :severity="'secondary'" text />
						<Button v-if="hasTauri && !isMobile" @click="openFile(`${localDir}${current.path}`)" v-tooltip.bottom="t('Open folder')" icon="pi pi-folder-open" severity="secondary" text />
						<FileImportSelector icon="pi pi-plus" v-if="isMyFolder && hasTauri && current.path!='' && current.path!='/' && current.path!='/users'" :path="`${localDir}${current.path}`" class="pointer ml-2" :placeholder="t('Import')" @saved="load"></FileImportSelector>
						<Button v-if="!props.small" @click="openQueue" :severity="!props.queueSize?'secondary':'primary'">
							<i :class="!props.queueSize?'pi pi-inbox':'pi pi-spinner pi-spin'"/>
							<Badge v-if="!!props.queueSize" :value="props.queueSize" size="small"></Badge>
						</Button>
						<Button v-if="moreItems.length>0" icon="pi pi-ellipsis-v" @click="moreToggle" :severity="'secondary'" aria-haspopup="true" aria-controls="more_menu">
						</Button>
					</template>
			</AppHeader>
			<Menu ref="moreMenu" id="more_menu" :model="moreItems" :popup="true" />
			<Popover ref="op" >
				<div class="flex w-full pt-4">
					<FloatLabel>
						<label>{{t('Local Dir')}}</label>
						<InputText  id="LocalDir" size="small" v-model="config.localDir"  class="flex-item"></InputText>
					</FloatLabel>
					<Button v-tooltip="'Copy'" size="small" :disabled="!localDir" icon="pi pi-copy" class="ml-2"  @click="copyDir"></Button>
					<FileFolderSelector v-if="hasTauri" :path="localDir" class="pointer ml-2" :placeholder="t('Choose')" @select="selectDir"></FileFolderSelector>
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
					<Button class="w-full" :label="t('Apply')" size="small" :disabled="!config.localDir" icon="pi pi-check" @click="saveConfig"></Button>
				</div>
			</Popover>
			<Card class="nopd" >
				<template #content>
					<InputGroup class="search-bar" >
						<DataViewLayoutOptions v-model="layout" style="z-index: 2;"/>
						<Textarea @keyup="watchEnter" v-model="typing" :autoResize="true" class="drak-input bg-gray-900 text-white flex-1" :placeholder="t('Type file name')" rows="1" cols="30" />
						<Button :disabled="!typing" icon="pi pi-search"  :label="null"/>
					</InputGroup>
				</template>
			</Card>
			<Loading v-if="props.loading"/>
			<ScrollPanel class="absolute-scroll-panel bar" v-else-if="filesFilter && filesFilter.length >0">
			<div class="text-center" >
				<TreeTable @sort="searchSort" v-if="layout == 'list'" @node-expand="onNodeExpand" loadingMode="icon" class="w-full file-block pb-8" :value="filesFilter" >
						<Column sortable field="name" :header="t('Name')" expander style="width: 50%">
								<template  #body="slotProps">
									<div class="selector pointer noSelect" v-longtap="handleLongTap(slotProps.node)" @click="selectFile($event,slotProps.node)" :class="{'active':!!slotProps.node.selected?.value,'px-2':!!slotProps.node.selected?.value,'py-1':!!slotProps.node.selected?.value}" style="max-width: 200px;text-overflow: ellipsis;overflow: hidden;white-space: nowrap;">
										<img :class="stateLabel(detailData[slotProps.node.path]) == 'not find'?'opacity-40':''" oncontextmenu="return false;"  :src="fileIcon(slotProps.node)" class="relative vertical-align-middle noEvent noSelect" width="20" style="top: -1px; overflow: hidden;margin: auto;"/>
										<b class="px-2 vertical-align-middle noSelect" ><i v-if="perIcon(slotProps.node)" :class="perIcon(slotProps.node)" style="font-size: 8pt;"  /> {{ slotProps.node.name }}</b>
									</div>
								</template>
						</Column>
						<Column field="state" :header="t('State')"  sortable>
								<template  #body="slotProps">
									<ProgressBar v-if="slotProps.node.ext!='/' && detailData[slotProps.node.path]?.downloading!=null" :value="detailData[slotProps.node.path].downloading*100" class="w-3rem" style="height: 6px;"><span></span></ProgressBar>
									<Tag v-else v-tooltip="detailData[slotProps.node.path]?.error?.message"  :severity="stateColor[stateLabel(detailData[slotProps.node.path])]" class="py-0 px-1" v-if="slotProps.node.ext!='/' && !!detailData[slotProps.node.path]">
										{{t(stateLabel(detailData[slotProps.node.path]))}}
									</Tag>
								</template>
						</Column>
						<Column field="size" :header="t('Size')"  sortable>
							<template  #body="slotProps">
								<div class="text-sm opacity-60" v-if="slotProps.node.ext!='/' && detailData[slotProps.node.path]?.size">{{bitUnit(detailData[slotProps.node.path].size)}}</div>
							</template>
						</Column>
						<Column v-if="!isMobile" field="time" :header="t('Time')" style="min-width: 12rem" sortable>
							<template  #body="slotProps">
								<div class="text-sm opacity-60" v-if="slotProps.node.ext!='/' && detailData[slotProps.node.path]?.time">
									{{new Date(detailData[slotProps.node.path].time).toLocaleString()}}
								</div>
							</template>
						</Column>
						
				</TreeTable>
				<div v-else class="grid text-left px-3 m-0 pt-3 pb-8" v-if="filesFilter && filesFilter.length >0">
						<div :class="!!props.small?'col-4 md:col-4 xl:col-2':'col-4 md:col-2 xl:col-1'" class="relative text-center file-block p-1" v-for="(file,hid) in filesFilter" :key="hid">
							<div class="selector p-2 relative noSelect" v-longtap="handleLongTap(file)" @click="selectFile($event,file)" :class="{'active':!!file.selected?.value}" >
								<img :class="stateLabel(detailData[file.path]) == 'not find'?'opacity-40':''" oncontextmenu="return false;"  :src="fileIcon(file)" class="pointer noEvent noSelect" height="40"  style="border-radius: 4px; overflow: hidden;margin: auto;"/>
								
								<ProgressSpinner v-if="file.loading" class="absolute opacity-60" style="width: 30px; height: 30px;margin-left: -35px;margin-top: 5px;" strokeWidth="10" fill="#000"
										animationDuration="2s" aria-label="Progress" />
								<div class="mt-1" v-tooltip="file">
									<b v-tooltip="file.name" class="multiline-ellipsis noSelect">
										<!-- <i v-if="app.uninstall" class="pi pi-cloud-download mr-1" /> -->
										<i v-if="perIcon(file)" :class="perIcon(file)" style="font-size: 8pt;"  /> {{ file.name }}
									</b>
								</div>
								<div class="mt-1">
									<ProgressBar v-if="file.ext!='/' && detailData[file.path]?.downloading!=null" :value="detailData[file.path].downloading*100" class="w-3rem" style="height: 6px;margin: auto;"><span></span></ProgressBar>
								</div>
								<Tag v-tooltip="detailData[file.path]?.error?.message" v-if="file.ext!='/' && !!detailData[file.path] && detailData[file.path]?.state!='synced'"  :severity="stateColor[stateLabel(detailData[file.path])]" class="py-0 px-1 mt-2" >
									{{t(stateLabel(detailData[file.path]))}}
								</Tag>
								<div v-if="file.ext!='/' && !!detailData[file.path]" class="text-sm opacity-60 mt-1">{{bitUnit(detailData[file.path].size)}}</div>
							</div>
					 </div>
				</div>
				<Config 
					ref="fileConfig" 
					:current="current"
					:loading="attrLoading"
					:saving="saving"
					:file="selectedFile"
					@remove="doRemove"
					@download="doDownload"
					@upload="doUpload"
					@cancelDownload="doCancelDownload"
					@openPreviewFile="openPreviewFile"
					@openPreview="openPreview"
					@delUser="delUser"
					/>
			</div>
			</ScrollPanel>
			<Empty v-else :title="emptyMsg"/>
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