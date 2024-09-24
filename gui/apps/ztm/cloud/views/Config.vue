<script setup>
import { ref, onMounted,onActivated, computed,watch } from "vue";
import { useRouter } from 'vue-router'
import FileService from '../service/FileService';
import { checker, bitUnit, openFile, isImage, saveFile, writeMobileFile,labels,colors,icons } from '@/utils/file';
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
	'load',
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
const actions = computed(()=>{
	 
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
		saveFile(item.fileUrl,()=>{
			saving.value = true;
		},()=>{
			saving.value = false;
			toast.add({ severity: 'success', summary:'Tips', detail: 'Saved.', life: 3000 });
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
const visible = ref(false);
const open = () => {
	visible.value = true;
	getEndpoints(()=>{
		loadMirrors()
	});
	;
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
	fileService.getMirrors(props.file?.path, endpoints.value, (d)=>{
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

defineExpose({ open, close })
onMounted(()=>{
	
})
</script>

<template>
	
	<Dialog style="max-width: 400px;min-width: 360px;min-height: 500px;" class="nopd noheader transparentMask" v-model:visible="visible" modal :dismissableMask="true" :draggable="true" >
		<Button v-if="active == 1 && isMyFolder && props.file?.access && props.file?.state != 'new' && !props.file?.error" :loading="aclLoading" class="absolute" style="right: 8px;z-index: 2;top: 8px;" @click="saveAcl" icon="pi pi-check" />
		<Loading v-if="loading" />
		<TabView v-else v-model:activeIndex="active">
			<TabPanel value="Info">
				<template #header>
					<div>
						<i class="pi pi-info-circle mr-2" />Info
					</div>
				</template>
				<Menu :model="actions" class="w-60">
						<template #start>
							<div v-if="props.file" class="text-center pt-4 relative">
								<img :class="stateLabel(props.file) == 'not find'?'opacity-40':''" :src="fileIcon" class="pointer" width="40" height="40" style="border-radius: 4px; overflow: hidden;margin: auto;"/>
								<div class="px-2 ">
									<Button style="word-break: break-all;" class="max-w-16rem" @click="copyFile" iconPos="right" icon="pi pi-copy" plain :label="props.file.name" text />
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
											<Tag v-tooltip="item?.error?.message" :severity="stateColor[stateLabel(file)]" v-if="item.label == 'State'">
												{{stateLabel(file)}}
											</Tag>
											<span v-else>{{ item.shortcut }}</span>
										</span>
								</a>
						</template>
						<template #end >
							<div class="px-4 pt-2 pb-1" v-if="props.file?.downloading != null">
									<ProgressBar v-tooltip="item?.error" :class="item?.error?'error':''"  :value="props.file.downloading*100">
										<span></span>
									</ProgressBar>
									<div class="flex">
										<div class="flex-item">
											{{bitUnit(props.file.size*props.file.downloading)}}  / {{bitUnit(props.file.size)}} 
										</div>
										<div v-if="props.file?.speed">
											{{bitUnit(props.file?.speed||0)}}/s
										</div>
									</div>
							</div>
							<div class="px-3 pt-2 pb-3 grid m-0 justify-content-between">
								<div  class="col-6 px-2 py-2" v-if="props.file?.ext != '/' && (props.file?.state == 'new' || props.file?.state == 'changed' || props.file?.state == 'synced')">
									<Button :loading="!!props.file.uploading" :disabled="!props.file?.path" @click="doUpload(props.file)" class="w-full" icon="pi pi-cloud-upload" label="Upload" severity="secondary" />
								</div>
								<div  class="col-6 px-2 py-2" v-if="props.file?.ext != '/' && props.file?.state != 'new'  && !props.file?.error">
									<Button v-if="props.file?.downloading == null" :disabled="!props.file?.path" @click="doDownload(props.file)" class="w-full" icon="pi pi-cloud-download" label="Download" severity="secondary"  />
									<Button v-else @click="doCancelDownload(props.file)" class="w-full" icon="pi pi-cloud-download" label="Cancel" severity="danger"  />
								</div>
								<div  class="col-6 px-2 py-2" v-if="!!props.file?.fileUrl && !props.file?.error">
									<Button :loading="saving" @click="saveAs(props.file)" class="w-full" icon="pi pi-save" label="Save" severity="secondary"  />
								</div>
								<div  class="col-6 px-2 py-2" v-if="props.file?.ext != '/' && isPC && props.file?.state != 'missing' && !props.file?.error">
									<Button :disabled="!props.file?.path" @click="openPreviewFile(props.file)" class="w-full" icon="pi pi-external-link" label="Open" severity="secondary"  />
								</div>
								<div  class="col-6 px-2 py-2" v-else-if="props.file?.ext != '/' && props.file?.state != 'new' && !props.file?.error">
									<Button :disabled="!props.file?.fileUrl" @click="openPreview(props.file)" class="w-full" icon="pi pi-eye" label="Preview" severity="secondary"  />
								</div>
							</div>
						</template>
				</Menu>
			</TabPanel>
			<TabPanel value="Sharing" v-if="isMyFolder && props.file?.access && props.file?.state != 'new' && !props.file?.error">
				<template #header>
					<div>
						<i class="pi pi-shield mr-2" />Sharing
					</div>
				</template>
				<div class="p-3">
					<div class="py-2">
						<b>All permission:</b>
					</div>
					<SelectButton class="w-full" v-model="props.file.access.all" :options="[{name:'Inherit',id:null},{name:'Readonly',id:'readonly'},{name:'Block',id:'block'}]" optionLabel="name" optionValue="id" aria-labelledby="basic" />
					<div class="pt-4 pb-2">
						<b>Users permission:</b>
					</div>
					<Listbox v-if="props.file.access?.users" :options="Object.keys(props.file.access.users)" class="w-full md:w-56" listStyle="max-height:250px">
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
							---
						</template>
						<template #footer>
							<div class="flex items-center pt-1 pb-2 px-3">
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
			</TabPanel>
			<TabPanel value="Sync" v-if="props.file?.ext == '/' && !!props.file?.path">
				<template #header>
					<div>
						<i class="pi pi-sync mr-2" :class="isMirror?'pi-spin text-primary':''"/>Auto-Sync
					</div>
				</template>
				<div class="p-3">
					<Listbox :loading="mirrorLoading" v-if="filterMirrors" :options="filterMirrors" class="w-full md:w-56" listStyle="max-height:250px">
						<template #option="slotProps">
								<div class="flex items-center pt-1 pb-2 px-0 w-full">
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
							------
						</template>
						<template #footer>
							<div class="flex items-center pt-1 pb-2 px-3">
								<div class="flex-item pr-1">
									<Select size="small" class="w-full"  v-model="mirror.user" :options="filterUnMirrorEps" optionLabel="name" optionValue="id" :filter="filterUnMirrorEps.length>8" placeholder="Select">
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
			</TabPanel>
		</TabView>
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