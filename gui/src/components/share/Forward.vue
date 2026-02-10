<script setup>
import { ref, onMounted,watch, computed } from "vue";
import { useStore } from 'vuex';
import ChatService from '@/service/ChatService';
import Targets from './Targets.vue';
import { resize, position } from "@/utils/window";
import { getShared, checker, bitUnit } from '@/utils/file';
import confirm from "@/utils/confirm";
import { send } from "@/utils/notification";
import _ from "lodash";

const props = defineProps(['open','message']);
const emits = defineEmits(['close','update:open'])
const store = useStore();
const chatService = new ChatService();
const fileLoading = ref(false);
const sending = ref(false);
const sendback = () => {
	sending.value = false;
	send("Forward", `Sent successfully.`);
}
const sendit = (item) => {
	sending.value = true;
	emits('update:open',false);
	if(item?.peer){
		chatService.newPeerMsg(item.peer, props.message, sendback);
	} else {
		chatService.newGroupMsg(item?.group, item?.creator, props.message, sendback);
	}
}
const sendFile = (item) => {
	if(props.message && !sending.value){
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

watch(()=>props.message,()=>{
	if(props.message){
	}
},{
	deep:true,
	immediate:true
})

watch(()=>props.open,()=>{
	visible.value = !!props.open;
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
	
	<Drawer class="relative drawer-h-80" @hide="hideSender" v-model:visible="visible" header="Forward" position="bottom">
		<ScrollPanel class="w-full absolute scroll-panel-bottom" :style="{'top': (`${45}px`)}">
		<div class="flex message-item pointer" :key="index">
			<div v-for="(file,index) in props.message?.files" class="flex flex-col py-3 px-3 gap-4 w-full" :class="{ 'border-t border-surface-200 dark:border-surface-700': index !== 0 }">
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
						<div v-if="file?.contentType || file?.type" class="text-right text-tip opacity-60" >
							<Tag class="text-ellipsis px-1 text-left tag-max-w-140" severity="secondary">{{file?.contentType || file?.type}}</Tag>
						</div>
					</div>
				</div>
			</div>
		</div>
		<Targets v-if="visible" @send="sendFile"/>
		</ScrollPanel>
	</Drawer>
</template>

<style lang="scss" scoped>
</style>