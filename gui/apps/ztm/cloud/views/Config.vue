<script setup>
import { ref, onMounted,onActivated, computed,watch } from "vue";
import { useRouter } from 'vue-router'
import FileService from '../service/FileService';
import { checker, bitUnit, openFile, isImage, saveFile,labels,colors,icons } from '@/utils/file';
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
const endpoints = ref([]);

const props = defineProps(['file','current','loading','endpoints'])
const emits = defineEmits([
	'download',
	'upload',
	'remove',
	'preview',
	'cancelDownload',
	'openPreviewFile', 
	'openPreview',
	'delUser',
])
const info = computed(() => {
	return store.getters['app/info']
});

const isMyFolder = computed(()=>{
	const pathAry = props.current.path.split("/");
	return pathAry[2] == info.value?.username
})
const infos = computed(()=>{
	 
	if(props.file?.ext == "/"){
		return [
			{
					label: 'Path',
					shortcut: props.file?.path,
					command: () => {
					}
			}
		]
		
	}else{
		return [
			{
					label: 'State',
					shortcut: props.file?.state,
					error: props.file?.error,
					command: () => {
					}
			},
			{
					label: 'Sources',
					badge: props.file?.sources?.length,
					command: () => {
					}
			},
			
			
			{
					label: 'Path',
					shortcut: props.file?.path,
					command: () => {
					}
			},
			{
					label: 'Hash',
					shortcut: props.file?.hash,
					command: () => {
					}
			},
			{
					label: 'Time',
					shortcut: !!props.file?.time?new Date(props.file.time).toLocaleString():'-',
					command: () => {
					}
			},
			{
					label: 'Size',
					shortcut: bitUnit(props.file?.size),
					command: () => {
					}
			},
		]
	}
})
const fullPath = computed(()=>(item)=>{
	if(item?.path){
		return item.path;
	} else {
		const _joinPath = [];
		const _pre = props.current?.path;
		if(!!_pre){
			_joinPath.push(_pre)
		}
		_joinPath.push(item.name);
		return _joinPath.join("/");
	}
})
const stateColor = ref(colors);
const stateLabel = computed(()=>labels)

const active = ref(0);
const aclLoading = ref(false);
const saveAcl = () => {
	aclLoading.value = true;
	fileService.setAcl(fullPath.value(props.file), props.file?.access || {}).then((res)=>{
		aclLoading.value = false;
		shareVisible.value = false;
		toast.add({ severity: 'success', summary:'Tips', detail: 'ACL Save successfully.', life: 3000 });
	})
}

const getEndpoints = (callback) => {
	fileService.getEndpoints().then((res)=>{
		endpoints.value = res || [];
		if(callback){
			callback()
		}
	})
}
const filterEps = computed(()=>(users)=>{
	const usernames = Object.keys(users);
	usernames.push(info.value?.username);
	return _.filter(props.endpoints, (item) => !_.includes(usernames, item.username));
})

const isPC = computed(()=>{
	const pm = platform();
	return pm != 'ios' && pm != 'android' && pm != 'web';
})
const acl = ref({
	user:'',
	permission: 'readonly'
})
const addUser = () => {
	emits('delUser',acl.value);
	acl.value = {
		user:'',
		permission: 'readonly'
	};
}
const delUser = (key) => {
	emits('delUser',key);
}
const doDownload = (item) => {
	emits('download',item);
}
const doUpload = (item) => {
	emits('upload',item);
}
const doCancelDownload = (item) => {
	if(item.path){
		fileService.cancelDownload(item.path, (error)=>{
			if(!error){
				toast.add({ severity: 'contrast', summary:'Tips', detail: `Cancelled.`, life: 3000 });
			}
			emits('cancelDownload',item);
		});
	}
}

const saving = ref(false);
const saveAs = (item) => {
	if(item.fileUrl){
		saveFile({
			fileUrl:item.fileUrl,
			before:()=>{
				saving.value = true;
			},
			after: ()=>{
				saving.value = false;
				toast.add({ severity: 'success', summary:'Tips', detail: 'Saved.', life: 3000 });
			}
		})
	}
}
const openPreviewFile = (item) => {
	emits('openPreviewFile',item);
}
const openPreview = (item) => {
	emits('openPreview',item);
}

const copyFile = () => {
	copy(JSON.stringify(selectedFile.value))
}
const infoVisible = ref(false);
const shareVisible = ref(false);
const syncVisible = ref(false);
const actionMenu = ref();
const open = (event) => {
	// visible.value = true;
	// active.value = 0;
	actionMenu.value.toggle({
		...event,
		currentTarget: event.target
	});
	getEndpoints(()=>{
		loadMirrors()
	});
	;
}

const blur = () => {
}
const close = () => {
	visible.value = false;
}
const mirror = ref({
	user:'',
	mode:'Download'
})
const mirrorLoading = ref(false);
const mirrors = ref([]);
const loadMirrors = () => {
	mirrorLoading.value = true;
	fileService.getMirrors(props.file?.path, endpoints.value, (d)=>{
		mirrorLoading.value = false;
		mirrors.value = d;
	},()=>{})
}
const isMirror = computed(() => {
	return !!mirrors.value.find((m)=>m?.ep?.id == info.value?.endpoint?.id)
})
const filterMirrors = computed(()=>{
	return mirrors.value.filter((m)=> {
		if(m?.data){
			m.data.mode = (m.data?.download && m.data?.upload)?'2-Way Sync':(m.data?.download?'Download':((m.data?.upload?'Upload':null)))
		}
		return m?.data?.download || m?.data?.upload;
	})
})
const filterUnMirrorEps = computed(()=>{
	return endpoints.value.filter((ep)=> {
		const _find = filterMirrors.value.find((m) => m?.ep?.id == ep?.id);
		return !_find || (!_find?.data?.download && !_find?.data?.upload)
	})
})
const postMirror = (ep, download, upload, callback) => {
	fileService.setMirror(props.file?.path, ep, {download, upload}).then(()=>{
		if(callback){
			callback();
		}
	})
}
const addMirror = () => {
	postMirror(mirror.value.user, mirror.value.mode == '2-Way Sync' || mirror.value.mode == 'Download', mirror.value.mode == '2-Way Sync' || mirror.value.mode == 'Upload', ()=>{
		mirror.value = {
			user:'',
			mode:'Download'
		};
		loadMirrors();
	})
}
const delMirror = (item) => {
	postMirror(item.ep?.id, false, false, ()=>{
		loadMirrors();
	})
}
const updMirror = (item, download, upload) => {
	postMirror(item.ep?.id, download, upload, ()=>{
		mirror.value = {
			user:'',
			download:true,
			upload:true,
		}
	})
}

const fileIcon = computed(()=> icons({
	...(props?.file||{}),
	isMirror: isMirror.value
}))

const deleteLoading = ref(false);
const unpublishLoading = ref(false);
const actions = computed(()=>{
	
	const _actions = [{
		label: 'Info',
		icon: 'pi pi-info-circle',
		// shortcut: '⌘+O',
		command(e){
			infoVisible.value = true;
		}
	}];
	if(isMyFolder.value && props.file?.access &&!!props.file?.state &&  props.file?.state != 'new' && !props.file?.error){
		_actions.push({
			label: 'Sharing',
			icon: 'pi pi-shield',
			// shortcut: '⌘+O',
			command(){
				shareVisible.value = true;
			}
		})
	}
	if(props.file?.ext == '/' && !!props.file?.path){
		_actions.push({
			label: 'Auto-Sync',
			icon: isMirror.value?'pi-spin text-primary pi pi-sync':'pi pi-sync',
			// shortcut: '⌘+O',
			command(){
				syncVisible.value = true;
			}
		})
	}
	if(props.file?.ext != '/' &&!!props.file?.state &&  (props.file?.state == 'new' || props.file?.state == 'changed' || props.file?.state == 'synced')){
		_actions.push({
			label: 'Upload',
			icon: 'pi pi-cloud-upload',
			loading: !!props.file.uploading,
			// shortcut: '⌘+O',
			command(){
				doUpload(props.file)
			}
		})
	}
	
	if(props.file?.ext != '/' && !!props.file?.state && props.file?.state != 'new'  && !props.file?.error){
		if(props.file?.downloading == null){
			_actions.push({
				label: 'Download',
				icon: 'pi pi-cloud-download',
				// shortcut: '⌘+O',
				command(){
					doDownload(props.file)
				}
			})
		} else {
				_actions.push({
					label: 'Cancel Download',
					icon: 'pi pi-cloud-download',
					// shortcut: '⌘+O',
					command(){
						doCancelDownload(props.file)
					}
				})
		}
	}
	
	if(!!props.file?.fileUrl && !props.file?.error){
		_actions.push({
			label: 'Save As',
			icon: 'pi pi-save',
			loading: saving.value,
			// shortcut: '⌘+O',
			command(){
				saveAs(props.file)
			}
		})
	}
	
	if(props.file?.ext != '/' && isPC.value &&!!props.file?.state &&  props.file?.state != 'missing' && !props.file?.error){
		
		_actions.push({
			label: 'Open',
			icon: 'pi pi-external-link',
			disabled: !props.file?.path,
			// shortcut: '⌘+O',
			command(){
				openPreviewFile(props.file)
			}
		})
	} else if(props.file?.ext != '/' && !!props.file?.state &&  props.file?.state != 'new' && !props.file?.error){
		
		_actions.push({
			label: 'Preview',
			icon: 'pi pi-eye',
			disabled: !props.file?.fileUrl,
			// shortcut: '⌘+O',
			command(){
				openPreviewFile(props.file)
			}
		})
	}
	
	_actions.push({separator: true});
	if(isMyFolder.value && !!props.file?.state &&  props.file?.state != 'new'){
		_actions.push({
			label: 'Take Down',
			class:'opacity-80',
			icon: 'pi pi-trash',
			loading: false,
			command(e){
				unpublishLoading.value = true;
				fileService.unpublish(props.file?.path,(reject)=>{
					unpublishLoading.value = false;
					if(!reject)
					emits('remove',props.file);
				})
			}
		})
	}
	_actions.push({
		label: 'Delete Local File',
		class:'opacity-80',
		icon: 'pi pi-trash',
		loading: false,
		command(e){
			deleteLoading.value = true;
			fileService.localDelete(props.file?.path,info.value?.endpoint?.id,(reject)=>{
				deleteLoading.value = false;
				if(!reject)
				emits('remove',props.file);
			})
		}
	})
	if(props.file?.downloading != null){
		_actions.push({separator: true});
	}
	return [
	    {
	        separator: true
	    },
			..._actions
	]
});
defineExpose({ open, close })
onMounted(()=>{
	
})
</script>

<template>
	<Menu ref="actionMenu" :popup="true" :model="actions" class="w-60" @blur="blur">
	    <template #start>
				<div class="flex pl-2">
					<img :class="stateLabel(props.file) == 'not find'?'opacity-40':''" :src="fileIcon" class="pointer" width="20" height="20" style="border-radius: 4px; overflow: hidden;margin: auto;"/>
					<b style="word-break: break-all;" class="flex-item p-2 ">
						{{props.file?.name||'...'}}
					</b>
					<Button @click="copyFile" iconPos="right" icon="pi pi-copy" plain text />
				</div>
	    </template>
	    <template #item="{ item, props }">
	        <a v-ripple class="flex items-center" v-bind="props.action">
	            <span :class="item.icon +' '+ item.class" />
	            <span :class="item.class?item.class:''">{{ item.label }}</span>
	            <Badge v-if="item.badge" class="ml-auto" :value="item.badge" />
	            <span v-if="item.shortcut" class="ml-auto border border-surface rounded bg-emphasis text-muted-color text-xs p-1">{{ item.shortcut }}</span>
							<span v-if="item.loading" class="ml-auto text-muted-color text-xs p-1 w-4rem text-right" >
								<i class="pi pi-spin pi-spinner opacity-70" style="font-size: 1rem"></i>
							</span>
					</a>
	    </template>
	    <template #end>
				<div class="px-2 pt-2 pb-2" v-if="props.file?.downloading != null">
						<ProgressBar style="height: 6px;" v-tooltip="item?.error" :class="item?.error?'error':''"  :value="props.file.downloading*100||50">
							<span></span>
						</ProgressBar>
						<div class="flex text-sm opacity-70">
							<div class="flex-item text-center">
								{{bitUnit(props.file.size*props.file.downloading)}}  / {{bitUnit(props.file.size)}} 
							</div>
						</div>
				</div>
	    </template>
	</Menu>
	<Dialog v-if="infoVisible" v-model:visible="infoVisible" style="max-width: 320px;min-width: 320px;min-height: 400px;" class="nopd noheader transparentMask" modal :dismissableMask="true" :draggable="true" >
		<Loading v-if="loading" />
		<Menu v-else :model="infos" class="w-60 noborder mt-2 mb-2">
				<template #start>
					<div v-if="props.file" class="text-center pt-4 relative">
						<img :class="stateLabel(props.file) == 'not find'?'opacity-40':''" :src="fileIcon" class="pointer" width="40" height="40" style="border-radius: 4px; overflow: hidden;margin: auto;"/>
						<div class="px-2 ">
							<Button style="word-break: break-all;" class="max-w-16rem" @click="copyFile" iconPos="right" icon="pi pi-copy" plain :label="props.file.name" text />
						</div>
					</div>
					
				</template>
				<template #submenulabel="{ item }">
						<span class="font-bold text-primary" >{{ item.label }}</span>
				</template>
				<template #item="{ item, props }">
					
						<a v-ripple class="flex items-center" v-bind="props.action">
								<span :class="item.icon" />
								<span>{{ item.label }}</span>
								<Badge v-if="item.badge>=0" class="ml-auto" :value="item.badge" />
								<span v-if="item.shortcut" class="ml-auto border border-surface rounded bg-emphasis text-muted-color text-xs p-1 max-w-14rem text-right" style="word-break: break-all;">
									<Tag v-tooltip="item?.error?.message" :severity="stateColor[stateLabel(file)]" v-if="item.label == 'State'">
										{{stateLabel(file)}}
									</Tag>
									<span v-else>{{ item.shortcut }}</span>
								</span>
						</a>
				</template>
		</Menu>
	</Dialog>
	<Dialog v-if="shareVisible" v-model:visible="shareVisible" style="max-width: 400px;min-width: 360px;min-height: 460px;" class="noclose smheader nopd transparentMask" modal :dismissableMask="true" :draggable="true" >
		<template #header>
			<i class="pi pi-shield mr-2" />Sharing
		</template>
		<Button v-if="isMyFolder && props.file?.access && props.file?.state != 'new' && !props.file?.error" :loading="aclLoading" class="absolute" style="right: 8px;z-index: 2;top: 8px;" @click="saveAcl" icon="pi pi-check" />
		<Loading v-if="loading" />
		<div v-else class="p-3">
			<div class="py-2">
				<b>All permission:</b>
			</div>
			<SelectButton class="w-full" v-model="props.file.access.all" :options="[{name:'Inherit',id:null},{name:'Readonly',id:'readonly'},{name:'Block',id:'block'}]" optionLabel="name" optionValue="id" aria-labelledby="basic" />
			<div class="pt-4 pb-2">
				<b>Users permission:</b>
			</div>
			<Listbox v-if="props.file.access?.users" :options="Object.keys(props.file.access.users)" class="w-full md:w-56 noborder noshadow" listStyle="max-height:250px">
				<template #option="slotProps">
						<div class="flex w-full">
							<div class="flex-item pt-1">
								<Avatar icon="pi pi-user" size="small" style="background-color: #ece9fc; color: #2a1261" />
								<span class="ml-2">{{slotProps.option}}</span>
							</div>
							<div>
								<Select size="small" class="w-full small"  v-model="props.file.access.users[slotProps.option]" :options="[{name:'Readonly',id:'readonly'},{name:'Block',id:'block'}]" optionLabel="name" optionValue="id" placeholder="Permission"/>
							</div>
						<div class="pl-1">
							<Button @click="delUser(slotProps.option)" icon="pi pi-minus" severity="secondary" />
						</div>
						</div>
				</template>
				<template #empty>
					<span></span>
				</template>
				<template #footer>
					<div class="flex items-center pt-1 pb-2 ">
						<div class="flex-item pr-1">
							<Select size="small" class="w-full"  v-model="acl.user" :options="filterEps(props.file.access.users)" optionLabel="username" optionValue="username" :filter="filterEps(props.file.access.users).length>8" placeholder="Endpoint"/>
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
		</Dialog>
		<Dialog v-if="syncVisible" v-model:visible="syncVisible" style="max-width: 400px;min-width: 360px;min-height: 400px;" class="nopd transparentMask smheader" modal :dismissableMask="true" :draggable="true" >
			<template #header>
				<i class="pi pi-sync mr-2" :class="isMirror?'pi-spin text-primary':''"/>Auto-Sync
			</template>
			<div class="p-3">
				<Loading v-if="mirrorLoading" />
				<Listbox v-else :options="filterMirrors" class="w-full md:w-56 noborder noshadow" listStyle="max-height:250px">
					<template #option="slotProps">
							<div class="flex items-center px-0 w-full">
								<div class="flex-item pr-2 py-2">
									<Tag>{{slotProps.option.ep?.name}}</Tag>
									<Tag v-if="info?.endpoint?.id == slotProps.option?.ep?.id" value="Local" class="ml-2" severity="contrast"/> 
								</div>
								<div class="flex-item">
									<Select 
										size="small" 
										class="w-full" 
										@change="updMirror(slotProps.option,slotProps.option.data.mode == 'Download' || slotProps.option.data.mode == '2-Way Sync',slotProps.option.data.mode == 'Upload' || slotProps.option.data.mode == '2-Way Sync')"  
										v-model="slotProps.option.data.mode" 
										:options="['Download','Upload','2-Way Sync']" 
										placeholder="Mode"/>
								</div>
								<div class="pl-2">
									<Button @click="delMirror(slotProps.option)" icon="pi pi-minus" severity="secondary" />
								</div>
							</div>
					</template>
					<template #empty>
					<span></span>
					</template>
					<template #footer>
						<div class="flex items-center pt-1 pb-2">
							<div class="flex-item pr-1">
								<Select size="small" class="w-full"  v-model="mirror.user" :options="filterUnMirrorEps" optionLabel="name" optionValue="id" :filter="filterUnMirrorEps.length>8" placeholder="Endpoint">
									<template #option="slotProps">
										{{ slotProps.option.name }}
										<Tag v-if="info?.endpoint?.id == slotProps.option.id" value="Local" class="ml-2" severity="contrast"/>
									</template>
								</Select>
							</div>
							<div class="flex-item">
								<Select 
									size="small" 
									class="w-full" 
									v-model="mirror.mode" 
									:options="['Download','Upload','2-Way Sync']" 
									placeholder="Mode"/>
							</div>
							<div class="pl-2 ">
								<Button :disabled="!mirror.user" @click="addMirror" icon="pi pi-plus" severity="secondary" />
							</div>
						</div>
					</template>
				</Listbox>
			</div>
	</Dialog>
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