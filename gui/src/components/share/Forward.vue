<script setup>
import { ref, onMounted,watch, computed } from "vue";
import { useStore } from 'vuex';
import ChatService from '@/service/ChatService';
import gptSvg from "@/assets/img/gpt.png";
import { resize, position } from "@/utils/window";
import { getShared, checker, bitUnit } from '@/utils/file';
import confirm from "@/utils/confirm";
import { send } from "@/utils/notification";
import _ from "lodash";

const props = defineProps(['open','paths']);
const emits = defineEmits(['close','update:open','update:paths'])
const store = useStore();
const chatService = new ChatService();
const selectedMesh = computed(() => {
	return store.getters["account/selectedMesh"]
});
const rooms = computed(() => store.getters["notice/rooms"]);
const uniRooms = computed(() => {
	let rtn = _.cloneDeep(rooms.value);
	let index = rtn.findIndex(item => item.peer == selectedMesh.value?.agent?.username);
	if (index != -1) {
	  let node = rtn.splice(index, 1)[0];
	  rtn.unshift(node);
	} else {
		rtn.unshift({
			peer: selectedMesh.value?.agent?.username,
		})
	}
	return rtn;
});
const windowWidth = ref(window.innerWidth);
const isMobile = computed(() => windowWidth.value<=768);

const loadrooms = () => {
	store.dispatch('notice/rooms');
}
const fileLoading = ref(false);
const hasFile = ref(false);
const files = ref()
const loadfiles = () => {
	fileLoading.value = true;
	getShared(true, (res)=>{
		fileLoading.value = false;
		if(res && res.length>0){
			files.value = res;
			hasFile.value = true;
		} else {
			hasFile.value = false;
		}
	})
}

const windowHeight = ref(window.innerHeight);
const viewHeight = computed(() => windowHeight.value - 45);
const sending = ref(false);
const sendback = () => {
	sending.value = false;
	send("Forward", `Sent successfully.`);
	emits('update:paths',null);
	files.value = null;
	hasFile.value = false;
}
const sendit = (item) => {
	sending.value = true;
	emits('update:open',false);
	const msg = {
		files: []
	}
	files.value.forEach((file)=>{
		const blob = new Blob([file.data], { type: file.mime });
		const fileObj = new File([blob], file.name, { type: file.mime });
		msg.files.push(fileObj)
	})
	if(item?.peer){
		chatService.newPeerMsg(item.peer, msg, sendback);
	} else {
		chatService.newGroupMsg(item?.group, item?.creator, msg, sendback);
	}
}
const sendFile = (item) => {
	if(files.value && files.value.length>0 && !sending.value){
		confirm.custom({
				message: `Are you sure send to ${item?.peer || item.name}?`,
				header: 'Tips',
				icon: 'pi pi-send',
				accept: () => {
					sendit(item);
				},
				reject: () => {
				}
		});
	}
}
const visible = ref(false);

watch(()=>props.paths,()=>{
	if(props.paths && props.paths.length>0){
		hasFile.value = true;
		loadfiles();
	}
},{
	deep:true,
	immediate:true
})

watch(()=>props.open,()=>{
	visible.value = !!props.open;
	if(visible.value){
		loadrooms();
	}
},{
	deep:true,
	immediate:true
})
watch(()=>selectedMesh,()=>{
	if(visible.value && selectedMesh.value){
		loadrooms();
	}
},{
	deep:true,
	immediate:true
})
const openSender = () => {
	emits('update:open',true);
}
const hideSender = () => {
	emits('update:open',false);
}
</script>

<template>
	
	<Button :loading="fileLoading || sending" @click="openSender" class="absolute" v-if="!!hasFile && !visible" icon="pi pi-send" aria-label="Send" style="right:10px; bottom: 70px;" />
	<Drawer class="relative" @hide="hideSender" v-model:visible="visible" header="Forward" position="bottom" style="height: 80%;">
		<ScrollPanel class="w-full absolute" style="bottom: 0;" :style="{'top': (`${45}px`)}">
		<div class="flex message-item pointer" :key="index">
			<div v-for="(file,index) in files" class="flex flex-col py-3 px-3 gap-4 w-full" :class="{ 'border-t border-surface-200 dark:border-surface-700': index !== 0 }">
				<div class="md:w-40 relative">
					<img :src="checker({name:file?.name})" height="40" />
				</div>
				<div class="flex-item" >
					<div class="flex" >
						<div class="flex-item" >
							<b>{{file?.name}}</b>
						</div>
					</div>
					<div class="flex mt-1" >
						<div class="flex-item" >
							{{bitUnit(file?.size *1)}}
						</div>
						<div v-if="file?.mime" class="text-right text-tip opacity-60" >
							<Tag class="text-ellipsis px-1 text-left" severity="secondary" style="max-width: 140px;">{{file?.mime}}</Tag>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="px-3 pt-3 pb-1 opacity-60"><b>{{selectedMesh?.name}} recent chats</b></div>
		<DataView class="message-list" :value="uniRooms">
				<template #list="slotProps">
						<div @click="sendFile(item)" class="flex flex-col message-item pointer" v-for="(item, index) in slotProps.items" :key="index">
							<div class="flex flex-col py-3 px-3 gap-4 w-full" :class="{ 'border-t border-surface-200 dark:border-surface-700': index !== 0 }">
									<div class="md:w-20 relative">
										<img v-if="item.isAi" :src="gptSvg" width="20" height="20" />
										<Avatar v-else-if="!!item.group" icon="pi pi-users" size="small"  />
										<Avatar v-else-if="selectedMesh?.agent?.username == item.peer" icon="pi pi-tablet" size="small"  />
										<Avatar v-else icon="pi pi-user" size="small"  />
										
									</div>
									<div class="flex-item" style="line-height: 25px;">
											<div class="flex" v-if="!!item?.peer">
												<div class="flex-item" >
													<b>{{item?.peer}}</b>
												</div>
												<Status :run="true" style="top: 7px;margin-right: 0;right: -10px;"/>
											</div>
											<div class="flex" v-else>
												<div class="flex-item" >
													<b>{{item.name}}</b>
												</div>
											</div>
									</div>
							</div>
						</div>
				</template>
			</DataView>
		</ScrollPanel>
	</Drawer>
</template>

<style lang="scss" scoped>
</style>