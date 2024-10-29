<script setup>
import { ref, onMounted,onBeforeUnmount, onActivated, watch, computed } from "vue";
import { useStore } from 'vuex';
import ChatService from '@/service/ChatService';
import userSvg from "@/assets/img/user.png";
import _ from 'lodash';
import { dayjs, extend } from '@/utils/dayjs';
extend()
const store = useStore();
const chatService = new ChatService();
const props = defineProps(['room','users']);
const emits = defineEmits(['back','ep','update:room']);
const selectedMesh = computed(() => {
	return store.getters["account/selectedMesh"]
});

const loading = ref(false);
const saving = ref(false);
const back = () => {
	emits('back')
}
const windowWidth = ref(window.innerWidth);
const isMobile = computed(() => windowWidth.value<=768);
const windowHeight = ref(window.innerHeight);
const viewHeight = computed(() => windowHeight.value - (isMobile.value?313:300));
const today = ref(new Date());
const msgs = ref([]);
const getHistory = () => {
	if(props.room?.group){
		chatService.getHistory({
			group: props.room?.group,
			creator: props.room?.creator,
			today: today.value
		}).then((res)=>{
			msgs.value = res;
		})
	} else {
		chatService.getHistory({
			peer: props.room?.peer,
			today: today.value
		}).then((res)=>{
			msgs.value = res;
		})
	}
}

const timeago = computed(() => (ts) => {
	const date = new Date(ts);
	return dayjs(date).fromNow();
})

watch(() => props.room, () => {
	getHistory()
},{
	deep:true,
	immediate: true
})
watch(() => today.value, () => {
	getHistory()
},{
	deep:false
})
</script>
<template>
	
	<AppHeader :back="back" >
	    <template #center>
	      <b>History</b>
	    </template>
	    <template #end> 
				<Button :loading="loading" icon="pi pi-history"  severity="secondary" text />
			</template>
	</AppHeader>
	<!-- props.room.members -->
	<ul class="nav-ul shadow relative" style="z-index:2">
		<li class="nav-li" style="padding: 0;line-height: 30px;">
			<DatePicker v-model="today" inline class="w-full" />
		</li>
	</ul>
	<VirtualScroller :delay="50" v-if="msgs&&msgs.length>0" :items="msgs" :itemSize="50" class="border border-surface-200 dark:border-surface-700 w-full" :style="`height:${viewHeight}px`">
	    <template v-slot:item="{ item, options }">
	        <div class="flex p-3 " :class="[{ 'surface-ground': options.odd,'surface-html':!options.odd }]" >
						<img :src="userSvg" width="16px" height="16px" />
						<div class="flex-item px-2">
							<div class="flex text-sm opacity-60">
								<div class="flex-item ">
									{{item?.sender}}
								</div>
								<div class="flex-item text-right">
									{{timeago(item?.time)}}
								</div>
							</div>
							<div class="flex" style="word-break: break-all;" v-if="item?.message?.type =='text'">
								{{item?.message?.content}}
							</div>
							<div class="flex" v-else>
								[File]
							</div>
						</div>
					</div>
	    </template>
	</VirtualScroller>
	<div class="p-4 text-center opacity-60" v-else>
		<i class="pi pi-box mr-2"/>No Message.
	</div>
</template>

<style lang="scss" scoped>
	:deep(th.p-datepicker-weekday-cell){
		text-align: center !important;
	}
</style>