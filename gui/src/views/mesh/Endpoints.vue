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
const endpoints = ref([]);
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
const usersMap = ref({})
const getEndpoints = () => {
	loading.value = true;
	loader.value = true;
	ztmService.getEndpoints(selectedMesh.value?.name)
		.then(res => {
			usersMap.value = {};
			console.log("Endpoints:")
			console.log(res)
			loading.value = false;
			setTimeout(() => {
				loader.value = false;
			},2000)
			endpoints.value = res || [];
			endpoints.value.forEach((ep,ei)=>{
				if(!!ep?.username){
					if(!usersMap.value[ep?.username]){
						usersMap.value[ep?.username] = []
					}
					usersMap.value[ep?.username].push(ep)
				}
			});
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
		// groups.value = data||[];
	})
}
const removeGroupUser = (group,user) => {
	usersService.exitGroupUser({
		group,user,callback(){
			loadgroup()
		}
	})
}

const visibleUserSelector = ref(false);
const selectedUsers = ref({});
const users = ref([])
const loadusers = () => {
	usersService.getUsers()
		.then(res => {
			users.value = res || [];
		})
}
const usersTree = computed(()=>{
	const _users = [];
	users.value.forEach((user,index)=>{
		_users.push({
			key:user,
			label:user,
			data:user,
		})
	});
	return _users;
})
const selectedGroup = ref({});
const selectGroup = (group) => {
	selectedGroup.value = group;
	selectedUsers.value = {};
	(group?.users || []).forEach((user)=>{
		selectedUsers.value[user] = {checked:true}
	})
	visibleUserSelector.value = true;
}
const appendUsers = () => {
	const _users = Object.keys(selectedUsers.value);
	usersService.appendGroupUser({
		users: _users,
		group: selectedGroup.value?.id,
		callback(){
			toast.add({ severity: 'success', summary:'Tips', detail: `${_users.length} user appended to ${selectedGroup.value?.name}.`, life: 3000 });
		}
	})
}
const removeGroup = (group) => {
	usersService.removeGroup({
		group: selectedGroup.value?.id,
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
}
const createGroup = () => {
	usersService.newGroup({
		name: groupname.value,
		users: [],
		callback(){
			toast.add({ severity: 'success', summary:'Tips', detail: `${groupname.value} created.`, life: 3000 });
			groupname.value = "";
		}
	})
}
onActivated(()=>{
	getEndpoints();
	loadusers();
})
onMounted(()=>{
	getStatsTimer();
})

watch(()=>selectedMesh,()=>{
	if(selectedMesh.value){
		getEndpoints();
		loadusers();
	}
},{
	deep:true,
	immediate:true
})

</script>

<template>
	
	<div class="flex flex-row min-h-screen">
		<div class="relative h-full min-h-screen" :class="{'w-22rem':!!selectEp,'w-full':!selectEp,'mobile-hidden':!!selectEp}">
			<AppHeader :main="true">
					<template #center>
						<b>{{t('Endpoints')}} ({{endpoints.length}})</b>
					</template>
			
					<template #end> 
						<Button icon="pi pi-refresh" text @click="getEndpoints"  :loading="loader"/>
						<Button text v-if="selectedMesh?.agent?.username == 'root' || true" icon="iconfont icon-add-user"  v-tooltip="t('Invite')"  @click="newInvite"/>
						<Button text v-if="selectedMesh?.agent?.username == 'root' || true" icon="iconfont icon-add-group-right"  v-tooltip="t('Create Group')"  @click="newGroup"/>
					</template>
			</AppHeader>
			
			<Loading v-if="loading"/>
			<ScrollPanel class="absolute-scroll-panel" v-else-if="endpoints && endpoints.length >0">
				<Accordion value="all">
					<AccordionPanel value="all">
						<AccordionHeader class="small">{{t('All')}} ({{Object.keys(usersMap).length}})</AccordionHeader>
						<AccordionContent>
							<DataView class="message-list" :value="Object.keys(usersMap)">
									<template #list="slotProps">
											<div class="flex flex-col message-item pointer" v-for="(key, index) in slotProps.items" :key="index" >
												<div v-if="usersMap[key].length <= 1" class="flex flex-col py-3 px-3 gap-4 w-full" :class="{ ' border-surface-200 dark:border-surface-700': index !== 0 }" @click="select(usersMap[key][0])">
													<div class="flex-item flex gap-2">
														<Avatar icon="pi pi-user" size="small" style="color: #2a1261" />
														<b class="line-height-4">{{ key }} </b>
														<Avatar class="ml-2" icon="pi pi-mobile" size="small" style="background-color: #ece9fc; color: #2a1261" />
														<b class="line-height-4">{{usersMap[key][0].name || usersMap[key][0].id}}</b>
														<span v-if="usersMap[key][0].isLocal && !selectEp" class="ml-2 relative" style="top: 2px;"><Tag severity="contrast" >{{t('Local')}}</Tag></span>
													</div>
													<div class="flex" v-if="!selectEp">
														<span class="py-1 px-2 opacity-70" v-if="!selectEp && stats[usersMap[key][0].id]">↑{{bitUnit(stats[usersMap[key][0].id]?.send)}}</span>
														<span class="py-1 px-2 opacity-70 mr-4" v-if="!selectEp && stats[usersMap[key][0].id]">↓{{bitUnit(stats[usersMap[key][0].id]?.receive)}}</span>
														<Status :run="usersMap[key][0].online" :tip="timeago(usersMap[key][0].heartbeat)"  style="top: 9px;margin-right: 0;"/>
													</div>
												</div>
												
												<Accordion v-else class="w-full block" :value="key">
													<AccordionPanel>
														<AccordionHeader class="flex">
															<div class="flex-item flex gap-2">
																<Avatar icon="pi pi-user" size="small" style="color: #2a1261" />
																<b class="line-height-4">{{ key }}</b>
																<OverlayBadge :value="usersMap[key].length" size="small"><Avatar class="ml-2" icon="pi pi-mobile" size="small" style="background-color: #ece9fc; color: #2a1261" /></OverlayBadge>
															</div>
														</AccordionHeader>
														<AccordionContent>	
															<div class="flex flex-col message-item pointer" v-for="(ep, index) in usersMap[key]" :key="index" >
																<div class="flex flex-col py-3 pr-3 pl-2 gap-4 w-full" :class="{ ' border-surface-200 dark:border-surface-700': index !== 0 }" @click="select(ep)">
																	<div class="flex-item flex gap-2">
																		<Avatar class="ml-2" icon="pi pi-mobile" size="small" style="background-color: #ece9fc; color: #2a1261" />
																		<b class="line-height-4">{{ep.name || ep.id}}</b>
																		<span v-if="ep.isLocal && !selectEp" class="ml-2 relative" style="top: 2px;"><Tag severity="contrast" >{{t('Local')}}</Tag></span>
																	</div>
																	<div class="flex" v-if="!selectEp">
																		<span class="py-1 px-2 opacity-70" v-if="!selectEp && stats[ep.id]">↑{{bitUnit(stats[ep.id]?.send)}}</span>
																		<span class="py-1 px-2 opacity-70 mr-4" v-if="!selectEp && stats[ep.id]">↓{{bitUnit(stats[ep.id]?.receive)}}</span>
																		<Status :run="ep.online" :tip="timeago(ep.heartbeat)"  style="top: 9px;margin-right: 0;"/>
																	</div>
																</div>
															</div>
														</AccordionContent>
													</AccordionPanel>
												</Accordion>
											</div>
									</template>
							</DataView>
						</AccordionContent>
					</AccordionPanel>
					<AccordionPanel v-for="(group,index) in groups" :key="index" :value="group.group">
							<AccordionHeader class="small flex">
								<div class="flex-item">{{ group?.name }} ({{group.users.length}})</div>
								<Button @click.stop="selectGroup(group)" size="small" icon="iconfont icon-add-user" text v-if="!selectEp && selectedMesh?.agent?.username == 'root' || true"/>
								<Button severity="secondary" @click.stop="removeGroup(group)" class="mr-2" size="small" icon="pi pi-trash" text v-if="!selectEp && selectedMesh?.agent?.username == 'root' || true"/>
							</AccordionHeader>
							<AccordionContent>
								<DataView class="message-list" :value="group.users">
										<template #list="slotProps">
												<div class="flex flex-col message-item pointer" v-for="(key, index) in slotProps.items" :key="index" >
													<div v-if="usersMap[key].length <= 1" class="flex flex-col py-3 px-3 gap-4 w-full" :class="{ ' border-surface-200 dark:border-surface-700': index !== 0 }" @click="select(usersMap[key][0])">
														<div class="flex-item flex gap-2">
															<Avatar icon="pi pi-user" size="small" style="color: #2a1261" />
															<b class="line-height-4">{{ key }} </b>
															<Avatar class="ml-2" icon="pi pi-mobile" size="small" style="background-color: #ece9fc; color: #2a1261" />
															<b class="line-height-4">{{usersMap[key][0].name || usersMap[key][0].id}}</b>
															<span v-if="usersMap[key][0].isLocal && !selectEp" class="ml-2 relative" style="top: 2px;"><Tag severity="contrast" >{{t('Local')}}</Tag></span>
														</div>
														<div class="flex" v-if="!selectEp">
															<span class="py-1 px-2 opacity-70" v-if="!selectEp && stats[usersMap[key][0].id]">↑{{bitUnit(stats[usersMap[key][0].id]?.send)}}</span>
															<span class="py-1 px-2 opacity-70 mr-4" v-if="!selectEp && stats[usersMap[key][0].id]">↓{{bitUnit(stats[usersMap[key][0].id]?.receive)}}</span>
															<Status :run="usersMap[key][0].online" :tip="timeago(usersMap[key][0].heartbeat)"  style="top: 9px;margin-right: 0;"/>
															<Button severity="secondary" size="small" icon="pi pi-times" text @click="removeGroupUser(group?.id,key)"  v-if="selectedMesh?.agent?.username == 'root' || true"/>
														</div>
													</div>
													
													<Accordion v-else class="w-full block" :value="key">
														<AccordionPanel>
															<AccordionHeader class="flex">
																<div class="flex-item flex gap-2">
																	<Avatar icon="pi pi-user" size="small" style="color: #2a1261" />
																	<b class="line-height-4">{{ key }}</b>
																	<OverlayBadge :value="usersMap[key].length" size="small"><Avatar class="ml-2" icon="pi pi-mobile" size="small" style="background-color: #ece9fc; color: #2a1261" /></OverlayBadge>
																</div>
																<Button severity="secondary" class="mr-2" size="small" icon="pi pi-times" text @click="removeGroupUser(group?.id,key)"  v-if="!selectEp && selectedMesh?.agent?.username == 'root' || true"/>
															</AccordionHeader>
															<AccordionContent>	
																<div class="flex flex-col message-item pointer" v-for="(ep, index) in usersMap[key]" :key="index" >
																	<div class="flex flex-col py-3 pr-3 pl-2 gap-4 w-full" :class="{ ' border-surface-200 dark:border-surface-700': index !== 0 }" @click="select(ep)">
																		<div class="flex-item flex gap-2">
																			<Avatar class="ml-2" icon="pi pi-mobile" size="small" style="background-color: #ece9fc; color: #2a1261" />
																			<b class="line-height-4">{{ep.name || ep.id}}</b>
																			<span v-if="ep.isLocal && !selectEp" class="ml-2 relative" style="top: 2px;"><Tag severity="contrast" >{{t('Local')}}</Tag></span>
																		</div>
																		<div class="flex" v-if="!selectEp">
																			<span class="py-1 px-2 opacity-70" v-if="!selectEp && stats[ep.id]">↑{{bitUnit(stats[ep.id]?.send)}}</span>
																			<span class="py-1 px-2 opacity-70 mr-4" v-if="!selectEp && stats[ep.id]">↓{{bitUnit(stats[ep.id]?.receive)}}</span>
																			<Status :run="ep.online" :tip="timeago(ep.heartbeat)"  style="top: 9px;margin-right: 0;"/>
																		</div>
																	</div>
																</div>
															</AccordionContent>
														</AccordionPanel>
													</Accordion>
												</div>
										</template>
								</DataView>
							</AccordionContent>
					</AccordionPanel>
				</Accordion>
			
			</ScrollPanel>
			<Empty v-else :title="emptyMsg"/>
		</div>

		<div class="flex-item" v-if="!!selectEp">
			<div class="shadow mobile-fixed">
				<EndpointDetail @back="() => selectEp=false" :ep="selectEp" @reload="getEndpoints"/>
			</div>
		</div>
		
		<Dialog class="noheader" v-model:visible="visibleUserSelector" modal :style="{ width: '25rem' }">
				<AppHeader :back="() => visibleUserSelector = false" :main="false">
						<template #center>
							<b>{{t('Append Users')}} <Badge class="ml-2 relative" style="top:-2px" v-if="Object.keys(selectedUsers).length>0" :value="Object.keys(selectedUsers).length"/></b>
						</template>
				
						<template #end> 
							<Button icon="pi pi-check" @click="appendUsers" :disabled="Object.keys(selectedUsers).length==0"/>
						</template>
				</AppHeader>
				<Tree :filter="usersTree.length>8" filterMode="lenient" v-model:selectionKeys="selectedUsers" :value="usersTree" selectionMode="checkbox" class="w-full md:w-[30rem]">
					<template #nodeicon="slotProps">
							<UserAvatar :username="slotProps.node?.label" size="20"/>
					</template>
					<template #default="slotProps">
							<b class="px-2">{{ slotProps.node?.label }}</b>
					</template>
				</Tree>
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
					<Button size="small" :disabled="!groupname" :label="t('Create')" class="ml-2"  @click="createGroup"></Button>
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
	padding-top: 7px;
	padding-bottom: 7px;
	font-size: 12px;
	background-color: var(--surface-subground) !important;
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