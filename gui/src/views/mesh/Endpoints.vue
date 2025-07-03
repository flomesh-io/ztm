<script setup>
import { ref,onActivated,onMounted,watch, computed } from "vue";
import { useRouter } from 'vue-router'
import ZtmService from '@/service/ZtmService';
import UsersService from '@/service/UsersService';
import EndpointDetail from './EndpointDetail.vue'
import { useStore } from 'vuex';
import { useConfirm } from "primevue/useconfirm";
import { bitUnit } from '@/utils/file';
import { useToast } from "primevue/usetoast";
import { dayjs, extend } from '@/utils/dayjs';
import { downloadFile } from '@/utils/file';
import clipboard from 'clipboardy';
import { useI18n } from 'vue-i18n';
import { isMobileWidth } from '@/utils/platform';
const { t, locale } = useI18n();
extend(locale.value)

const store = useStore();
const router = useRouter();
const ztmService = new ZtmService();
const usersService = new UsersService();
const confirm = useConfirm();
const loading = ref(false);
const toast = useToast();
const loader = ref(false);
const status = ref({});
const stats = ref({})
const meshes = computed(() => {
	return store.getters['account/meshes']
});
const selectedMesh = computed(() => {
	return store.getters["account/selectedMesh"]
});
const timeago = computed(() => (ts) => {
	let label = "Last heartbeat: ";
	if(ts>0){
		const date = new Date(ts);
		return label + dayjs(date).fromNow();
	} else {
		return label + "None";
	}
})
const getStats = () => {
	
	ztmService.getEndpointStats(selectedMesh.value?.name)
		.then(res => {
			stats.value = res || {};
		})
		.catch(err => console.log('Request Failed', err)); 
}
const getStatsTimer = () => {
	setTimeout(()=>{
		getStats();
		getStatsTimer();
	},3000)
}
const users = ref([]);
const usersMap = ref({});
const endpointsMap = ref({});
const filter = ref({
	keyword:'',
	limit:50,
	offset:0
})
const more = ref({
	default:false,
})
const searchUsers = () => {
	filter.value.offset = 0;
	more.value.default = false;
	loadusers();
}
const nextUsers = () => {
	filter.value.offset += filter.value.limit;
	more.value.default = false;
	loadusers();
}
const loadusers = () => {
	loading.value = true;
	loader.value = true;
	ztmService.getUsers(selectedMesh.value?.name,filter.value)
		.then(res => {
			if(filter.value.offset == 0){
				users.value = res || [];
			} else {
				users.value = users.value.concat(res);
			}
			more.value.default = res.length == filter.value.limit;
			res.forEach((user)=>{
				usersMap.value[user?.name] = user
			})
			loading.value = false;
			setTimeout(() => {
				loader.value = false;
			},2000)
		})
		.catch(err => {
			console.log('Request Failed', err);
			loading.value = false;
			loader.value = false;
		}); 
}
const loadepByUser = (user) => {
	ztmService.getEndpoints(selectedMesh.value?.name, {user} )
		.then(res => {
			usersMap.value[user].endpoints.instances = res;
		})
		.catch(err => console.log('Request Failed', err)); 
}
const typing = ref('');

const selectEp = ref();
const select = (node) => {
	selectEp.value = null;
	setTimeout(()=>{
		selectEp.value = node;
	},100)
}
const emptyMsg = computed(()=>{
	if(!!selectedMesh.value?.name){
		return t('No endpoint.')
	} else {
		return t(`First, join a Mesh.`)
	}
});
const username = ref('');
const identity = ref('');
const op = ref();
const toggle = (event) => {
	username.value = "";
	identity.value = "";
	permit.value = null;
	op.value.toggle(event);
}
const permit = ref(null)
const permitStr = computed(()=>{
	if(typeof(permit.value) == 'object'){
		return JSON.stringify(permit.value);
	} else if(typeof(permit.value) == 'string'){
		return permit.value;
	} else {
		return permit.value;
	}
})
const inviteEp = () => {
	ztmService.inviteEp(selectedMesh.value?.name, username.value, identity.value)
		.then(data => {
			permit.value = data;
			toast.add({ severity: 'success', summary:'Tips', detail: `${username.value} permit generated.`, life: 3000 });
		})
		.catch(err => console.log('Request Failed', err)); 
}
const download = () => {
	downloadFile({
		data: permitStr.value,
		fileName:`${username.value}-permit`,
		ext: 'txt'
	})
}
const copy = () => {
	clipboard.write(permitStr.value).then(()=>{
		toast.add({ severity: 'contrast', summary: 'Tips', detail: t(`Copied.`), life: 3000 });
	});
}
const visibleImport = ref(false);
const newInvite = () => {
	visibleImport.value = true;
	permit.value = null;
	username.value = "";
	identity.value = "";
}
const groups = ref([])
const loadgroup = () => {
	usersService.getGroups().then(data => {
		groups.value = data||[];
	})
}
const removeGroupUser = (group,user) => {
	usersService.exitGroupUser({
		group,user,callback(){
			loadgroup()
		}
	})
}
const chatUser = (n) => {
	router.push(`/mesh/chat?user=${n}`)
}
const visibleUserSelector = ref(false);
const selectedUsers = ref({});
const usersTree = computed(()=>{
	const _users = [];
	users.value.forEach((user,index)=>{
		_users.push({
			key:user?.name,
			label:user?.name,
			data:user?.name,
		})
	});
	return _users;
})
const selectedGroup = ref({});
const selectGroup = (group,type) => {
	selectedGroup.value = group;
	selectedUsers.value = {};
	if(type == 'adduser'){
		(group?.users || []).forEach((user)=>{
			selectedUsers.value[user] = {checked:true}
		})
		visibleUserSelector.value = true;
	} else {
		groupname.value = group?.name;
		visibleCreateGroup.value = true;
	}
}
const load = () => {
	loadusers();
	loadgroup();
}
const saving = ref(false);
const appendUsers = () => {
	saving.value = true;
	const _users = Object.keys(selectedUsers.value);
	usersService.appendGroupUser({
		users: _users,
		group: selectedGroup.value?.id,
		callback(){
			visibleUserSelector.value = false;
			saving.value = false;
			loadgroup();
			toast.add({ severity: 'success', summary:'Tips', detail: `${_users.length} user appended to ${selectedGroup.value?.name}.`, life: 3000 });
		}
	})
}
const removeUser = (username) => {
	ztmService.deleteUser(selectedMesh.value?.name, username, ()=>{
		load()
	})
}
const removeGroup = (group) => {
	usersService.removeGroup({
		group: group?.id,
		callback(){
			loadgroup()
		}
	})
}
const groupname = ref('');
const visibleCreateGroup = ref(false);
const newGroup = () => {
	visibleCreateGroup.value = true;
	groupname.value = "";
	selectedGroup.value = {};
}
const postGroup = () => {
	saving.value = true;
	if(selectedGroup.value?.id){
		usersService.setGroupName({
			group: selectedGroup.value?.id,
			name: groupname.value,
			callback(){
				toast.add({ severity: 'success', summary:'Tips', detail: `${groupname.value} updated.`, life: 3000 });
				groupname.value = "";
				visibleCreateGroup.value = false;
				saving.value = false;
				setTimeout(()=>{
					loadgroup();
				},1000)
			}
		})
	} else {
		usersService.newGroup({
			name: groupname.value,
			users: [],
			callback(){
				toast.add({ severity: 'success', summary:'Tips', detail: `${groupname.value} created.`, life: 3000 });
				groupname.value = "";
				visibleCreateGroup.value = false;
				saving.value = false;
				setTimeout(()=>{
					loadgroup();
				},1000)
			}
		})
	}
}
const changeLabels = (ep) => {
	ztmService.changeEpLabels(selectedMesh.value?.name, ep?.id, ep?.labels||[])
		.then(data => {})
		.catch(err => console.log('Request Failed', err)); 
}

const isMobile = computed(isMobileWidth);
onActivated(()=>{
	load()
})
onMounted(()=>{
	getStatsTimer();
})

watch(()=>selectedMesh,()=>{
	if(selectedMesh.value){
		load()
	}
},{
	deep:true,
	immediate:true
})
// || true to open dev manage
const manage = computed(()=> selectedMesh.value?.agent?.username == 'root')
</script>

<template>
	
	<div class="flex flex-row min-h-screen">
		<div class="relative h-full min-h-screen" :class="{'w-22rem':!!selectEp,'w-full':!selectEp,'mobile-hidden':!!selectEp}">
			<AppHeader :main="true">
					<template #center>
						<IconField>
							<InputIcon class="pi pi-search" />
							<InputText style="background-color: transparent;" v-model="filter.keyword" :placeholder="t('Search')" @input="searchUsers"/>
						</IconField>
					</template>
			
					<template #end> 
						<Button icon="pi pi-refresh" text @click="load"  :loading="loader"/>
						<Button text v-if="manage" icon="iconfont icon-add-user"  v-tooltip="t('Invite')"  @click="newInvite"/>
						<Button text v-if="manage" icon="iconfont icon-add-group-right"  v-tooltip="t('Create Group')"  @click="newGroup"/>
					</template>
			</AppHeader>
			
			<Loading v-if="loading && filter.offset==0"/>
			<ScrollPanel class="absolute-scroll-panel" v-else-if="Object.keys(usersMap).length >0">
				<Accordion value="all">
					<AccordionPanel class="small" value="all">
						<AccordionHeader class="small">{{t('Default')}} ({{users.length}})</AccordionHeader>
						<AccordionContent>
							<DataView class="message-list" :value="users" >
									<template #empty>
										<div class="p-4">{{emptyMsg}}</div>
									</template>
									<template #list="slotProps">
											<div class="flex flex-col message-item pointer" v-for="(user, index) in slotProps.items" :key="index" >
												<div v-if="user.endpoints?.count <= 1" class="flex flex-col py-3 px-3 gap-4 w-full" :class="{ ' border-surface-200 dark:border-surface-700': index !== 0 }" @click="select(user.endpoints?.instances[0])">
													<div class="flex-item flex gap-2">
														<UserAvatar :size="28" :username="user.name"/>
														<b class="line-height-4">{{ user.name }} </b>
														<Avatar class="ml-2" icon="pi pi-mobile" size="small" style="background-color: #ece9fc; color: #2a1261" />
														<b class="line-height-4">{{user.endpoints?.instances[0].name || user.endpoints?.instances[0].id}}</b>
														<span v-if="user.endpoints?.instances[0]?.isLocal && !selectEp" class="ml-2 relative" style="top: 2px;"><Tag severity="contrast" >{{t('Local')}}</Tag></span>
														<ChipList @change="changeLabels(user.endpoints?.instances[0])" class="ml-2 relative" style="top: 4px;" :readonly="user.endpoints?.instances[0]?.id != selectedMesh?.agent?.id" :placeholder="t('Label')" listType="tag" v-if="!isMobile && !selectEp" v-model:list="user.endpoints.instances[0].labels"/>
													</div>
													<div class="flex" v-if="!selectEp">
														
														<span class="py-1 px-2 opacity-70" v-if="!selectEp && stats[user.endpoints?.instances[0].id]">↑{{bitUnit(stats[user.endpoints?.instances[0].id]?.send)}}</span>
														<span class="py-1 px-2 opacity-70 mr-4" v-if="!selectEp && stats[user.endpoints?.instances[0].id]">↓{{bitUnit(stats[user.endpoints?.instances[0].id]?.receive)}}</span>
														<Status :run="user.endpoints?.instances[0]?.online" :tip="timeago(user.endpoints?.instances[0]?.heartbeat)"  style="top: 9px;margin-right: 0;"/>
														
														<Button severity="secondary" icon="iconfont icon-add-chat" text @click.stop="chatUser(user.name)"  v-if="!selectEp && manage"/>
														<Button severity="secondary" icon="pi pi-times" text @click.stop="removeUser(user.name)"  v-if="!selectEp && manage"/>
													</div>
												</div>
												
												<Accordion v-else class="w-full block" :value="user.name">
													<AccordionPanel>
														<AccordionHeader class="flex">
															<div class="flex-item flex gap-2" @click="loadepByUser(user.name)">
																<UserAvatar :size="28" :username="user.name"/>
																<b class="line-height-4">{{ user.name }}</b>
																<OverlayBadge :value="user.endpoints?.count" size="small"><Avatar class="ml-2" icon="pi pi-mobile" size="small" style="background-color: #ece9fc; color: #2a1261" /></OverlayBadge>
															</div>
															<Button severity="secondary" icon="iconfont icon-add-chat" text @click.stop="chatUser(user.name)"  v-if="!selectEp && manage"/>
															<Button severity="secondary" class="mr-2" icon="pi pi-times" text @click.stop="removeUser(user.name)"  v-if="!selectEp && manage"/>
														</AccordionHeader>
														<AccordionContent>	
															<div class="flex flex-col message-item pointer" v-for="(ep, index) in (usersMap[user.name]?.endpoints?.instances||[])" :key="index" >
																<div class="flex flex-col py-3 pr-3 pl-2 gap-4 w-full" :class="{ ' border-surface-200 dark:border-surface-700': index !== 0 }" @click="select(ep)">
																	<div class="flex-item flex gap-2">
																		<Avatar class="ml-2" icon="pi pi-mobile" size="small" style="background-color: #ece9fc; color: #2a1261" />
																		<b class="line-height-4">{{ep.name || ep.id}}</b>
																		<span v-if="ep?.isLocal && !selectEp" class="ml-2 relative" style="top: 2px;"><Tag severity="contrast" >{{t('Local')}}</Tag></span>
																		<ChipList @change="changeLabels(ep)" class="ml-2 relative" style="top: 4px;" :readonly="ep.id != selectedMesh?.agent?.id && selectedMesh?.agent?.username != user.name" :placeholder="t('Label')" listType="tag" v-if="!isMobile && !selectEp" v-model:list="ep.labels"/>
																	</div>
																	<div class="flex" v-if="!selectEp">
																		<span class="py-1 px-2 opacity-70" v-if="!selectEp && stats[ep.id]">↑{{bitUnit(stats[ep.id]?.send)}}</span>
																		<span class="py-1 px-2 opacity-70 mr-4" v-if="!selectEp && stats[ep.id]">↓{{bitUnit(stats[ep.id]?.receive)}}</span>
																		<Status :run="ep?.online" :tip="timeago(ep?.heartbeat)"  style="top: 9px;margin-right: 0;"/>
																	</div>
																</div>
															</div>
														</AccordionContent>
													</AccordionPanel>
												</Accordion>
											</div>
									</template>
							</DataView>
							<div v-if="more.default" class="message-item pointer text-center py-3 opacity-50" @click="nextUsers" >
								<i v-if="!loading" class="pi pi-arrow-down mr-1 relative" style="top: 1px;"/> 
								<i v-else class="pi pi-spin pi-spinner relative" style="top: 2px;margin: 0;width:16px;height: 16px;font-size: 16px;"></i>
								{{t('More')}}
							</div>
							
						</AccordionContent>
					</AccordionPanel>
					<AccordionPanel class="small" v-for="(group,index) in groups" :key="index" :value="group.id">
							<AccordionHeader class="small flex">
								<div class="flex-item">{{ group?.name }} <span v-if="group.users?.length>0">({{group.users.length}})</span></div>
								<Button @click.stop="selectGroup(group,'rename')" size="small" icon="pi pi-pen-to-square" text v-if="!selectEp && manage"/>
								<Button @click.stop="selectGroup(group,'adduser')" size="small" icon="iconfont icon-add-user" text v-if="!selectEp && manage"/>
								<Button severity="secondary" @click.stop="removeGroup(group)" class="mr-2" size="small" icon="pi pi-trash" text v-if="!selectEp && manage"/>
							</AccordionHeader>
							<AccordionContent>
								<DataView v-if="group.users && group.users.length>0" class="message-list" :value="group.users.filter((u)=>u.indexOf(filter.keyword)>=0)">
										<template #empty>
											<div class="p-4">{{emptyMsg}}</div>
										</template>
										<template #list="slotProps">
												<div class="flex flex-col message-item pointer" v-for="(key, index) in slotProps.items" :key="index" >
													<div v-if="usersMap[key]?.endpoints?.count <= 1" class="flex flex-col py-3 px-3 gap-4 w-full" :class="{ ' border-surface-200 dark:border-surface-700': index !== 0 }" @click="select(usersMap[key].endpoints?.instances[0])">
														<div class="flex-item flex gap-2">
															<UserAvatar :size="28" :username="key"/>
															<b class="line-height-4">{{ key }} </b>
															<Avatar class="ml-2" icon="pi pi-mobile" size="small" style="background-color: #ece9fc; color: #2a1261" />
															<b class="line-height-4">{{usersMap[key].endpoints?.instances[0].name || usersMap[key].endpoints?.instances[0].id}}</b>
															<span v-if="usersMap[key].endpoints?.instances[0]?.isLocal && !selectEp" class="ml-2 relative" style="top: 2px;"><Tag severity="contrast" >{{t('Local')}}</Tag></span>
															<ChipList @change="changeLabels(usersMap[key].endpoints?.instances[0])" class="ml-2 relative" style="top: 4px;" :readonly="usersMap[key].endpoints?.instances[0]?.id != selectedMesh?.agent?.id" :placeholder="t('Label')" listType="tag" v-if="!isMobile && !selectEp && usersMap[key]?.endpoints?.instances[0]?.labels" v-model:list="usersMap[key].endpoints.instances[0].labels"/>
														</div>
														<div class="flex" v-if="!selectEp">
															<span class="py-1 px-2 opacity-70" v-if="!isMobile && !selectEp && stats[usersMap[key].endpoints?.instances[0].id]">↑{{bitUnit(stats[usersMap[key].endpoints?.instances[0].id]?.send)}}</span>
															<span class="py-1 px-2 opacity-70 mr-4" v-if="!isMobile && !selectEp && stats[usersMap[key].endpoints?.instances[0].id]">↓{{bitUnit(stats[usersMap[key].endpoints?.instances[0].id]?.receive)}}</span>
															<Status :run="usersMap[key].endpoints?.instances[0]?.online" :tip="timeago(usersMap[key].endpoints?.instances[0]?.heartbeat)"  style="top: 9px;margin-right: 0;"/>
															
															<Button severity="secondary" icon="iconfont icon-add-chat" text @click.stop="chatUser(key)"  v-if="!selectEp && manage"/>
															<Button severity="secondary" icon="pi pi-times" text @click.stop="removeGroupUser(group?.id,key)"  v-if="!selectEp && manage"/>
														</div>
													</div>
													
													<Accordion v-else-if="!!usersMap[key]" class="w-full block" :value="key">
														<AccordionPanel>
															<AccordionHeader class="flex">
																<div class="flex-item flex gap-2" @click="loadepByUser(key)">
																	<UserAvatar :size="28" :username="key"/>
																	<b class="line-height-4">{{ key }}</b>
																	<OverlayBadge :value="usersMap[key].endpoints?.count" size="small"><Avatar class="ml-2" icon="pi pi-mobile" size="small" style="background-color: #ece9fc; color: #2a1261" /></OverlayBadge>
																</div>
																<Button severity="secondary" icon="iconfont icon-add-chat" text @click.stop="chatUser(key)"  v-if="!selectEp && manage"/>
																<Button severity="secondary" class="mr-2" size="small" icon="pi pi-times" text @click.stop="removeGroupUser(group?.id,key)"  v-if="!selectEp && manage"/>
															</AccordionHeader>
															<AccordionContent>	
																<div class="flex flex-col message-item pointer" v-for="(ep, index) in usersMap[key].endpoints?.instances" :key="index" >
																	<div class="flex flex-col py-3 pr-3 pl-2 gap-4 w-full" :class="{ ' border-surface-200 dark:border-surface-700': index !== 0 }" @click="select(ep)">
																		<div class="flex-item flex gap-2">
																			<Avatar class="ml-2" icon="pi pi-mobile" size="small" style="background-color: #ece9fc; color: #2a1261" />
																			<b class="line-height-4">{{ep.name || ep.id}}</b>
																			<span v-if="ep?.isLocal && !selectEp" class="ml-2 relative" style="top: 2px;"><Tag severity="contrast" >{{t('Local')}}</Tag></span>
																			<ChipList @change="changeLabels(ep)" class="ml-2 relative" style="top: 4px;" :readonly="ep.id != selectedMesh?.agent?.id && selectedMesh?.agent?.username != key" :placeholder="t('Label')" listType="tag" v-if="!isMobile && !selectEp" v-model:list="ep.labels"/>
																		</div>
																		<div class="flex" v-if="!selectEp">
																			<span class="py-1 px-2 opacity-70" v-if="!isMobile && !selectEp && stats[ep.id]">↑{{bitUnit(stats[ep.id]?.send)}}</span>
																			<span class="py-1 px-2 opacity-70 mr-4" v-if="!isMobile && !selectEp && stats[ep.id]">↓{{bitUnit(stats[ep.id]?.receive)}}</span>
																			<Status :run="ep?.online" :tip="timeago(ep?.heartbeat)"  style="top: 9px;margin-right: 0;"/>
																		</div>
																	</div>
																</div>
															</AccordionContent>
														</AccordionPanel>
													</Accordion>
												</div>
										</template>
								</DataView>
								<div class="py-4 text-center" v-else>
									<Button @click.stop="selectGroup(group,'adduser')" :label="t('Append Users')" icon="iconfont icon-add-user" v-if="!selectEp && manage">
									</Button>
								</div>
							</AccordionContent>
					</AccordionPanel>
				</Accordion>
			
			</ScrollPanel>
			<Empty v-else :title="emptyMsg"/>
		</div>

		<div class="flex-item" v-if="!!selectEp">
			<div class="shadow mobile-fixed">
				<EndpointDetail @back="() => selectEp=false" :ep="selectEp" @reload="loadusers"/>
			</div>
		</div>
		
		<Dialog class="noheader" v-model:visible="visibleUserSelector" modal :style="{ width: '25rem' }">
				<AppHeader :back="() => visibleUserSelector = false" :main="false">
						<template #center>
							<b>{{t('Append Users')}} <Badge class="ml-2 relative" style="top:-2px" v-if="Object.keys(selectedUsers).length>0" :value="Object.keys(selectedUsers).length"/></b>
						</template>
				
						<template #end> 
							<Button :loading="saving" icon="pi pi-check" @click="appendUsers" :disabled="Object.keys(selectedUsers).length==0"/>
						</template>
				</AppHeader>
				<UserSelector
					:app="true" 
					size="small"
					class="w-full"
					:mesh="selectedMesh"
					multiple="tree" 
					:user="selectedMesh?.agent?.username" 
					v-model="selectedUsers" />
		</Dialog>
		
		<Dialog class="noheader" v-model:visible="visibleImport" modal :dismissableMask="true">
			<div class="p-2" v-if="!permit">
				<div class="w-full">
					<CertificateUploder placeholder="Identity" v-model="identity" label="Identity"/>
				</div>
				<div class="flex mt-2 w-full">
					<InputText size="small" :placeholder="t('Username')" v-model="username"  class="flex-item"></InputText>
					<Button size="small" :disabled="!username || username == 'root'" :label="t('Invite')" class="ml-2"  @click="inviteEp"></Button>
				</div>
			</div>
			<div class="p-2" v-else>
				<Textarea disabled style="background-color: transparent !important;" class="w-full" rows="8" cols="40" :value="permitStr"/>
				<div class="flex mt-1">
					<Button size="small"  :label="t('Copy')" class="flex-item mr-1"  @click="copy"></Button>
					<Button size="small"  :label="t('Download')" class="flex-item"  @click="download"></Button>
				</div>
			</div>
		</Dialog>
		<Dialog class="noheader" v-model:visible="visibleCreateGroup" modal :dismissableMask="true">
			<div class="p-2" >
				<div class="flex mt-2 w-full">
					<InputText size="small" :placeholder="t('Group Name')" v-model="groupname"  class="flex-item"></InputText>
					<Button size="small" :loading="saving" :disabled="!groupname" :label="!!selectedGroup?.id?t('Save'):t('Create')" class="ml-2"  @click="postGroup"></Button>
				</div>
			</div>
		</Dialog>
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
:deep(.p-accordionheader){
	padding-top: 14px;
	padding-bottom: 14px;
	padding-left: 14px;
	padding-right: 14px;
	color: inherit;
	border-radius: 0 !important;
}

:deep(.p-accordionheader.small){
	padding-top: 8px;
	padding-bottom: 8px;
	font-size: 12px;
	background-color: var(--p-surface-subground) !important;
}
:deep(.small.p-accordionpanel){
	border-bottom: 1px solid var(--p-surface-border) !important;
}
:deep(.p-accordioncontent-content){
	padding: 0;
}
:deep(.p-accordionheader-toggle-icon){
	opacity: 0.5;
}
:deep(.p-accordionpanel){
	border-width: 0 !important;
	border-radius: 0 !important;
}
</style>