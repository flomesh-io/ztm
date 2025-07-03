<script setup>
import { ref, onMounted,onBeforeUnmount, onActivated, watch, computed } from "vue";
import { useStore } from 'vuex';
import ChatService from '@/service/ChatService';
import userSvg from "@/assets/img/user.png";
import { chatFileType, bitUnit, extIcon } from '@/utils/file';
import _ from 'lodash';
import { dayjs, extend } from '@/utils/dayjs';
import { useI18n } from 'vue-i18n';
const { t, locale } = useI18n();
extend(locale.value)
const store = useStore();
const chatService = new ChatService();
const props = defineProps(['room']);
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
const isMobile = computed(() => windowWidth.value<=1000);
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
const getUrl = computed(()=> (file, sender) => {
	const type = chatFileType(file.contentType);
	const src = chatService.getFileUrl(file, sender);
	if(chatService.isBlob(type)){
		return `${src}.${file.contentType.split("/")[1]}`;
	} else {
		return src;
	}
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
	      <b>{{t('History')}}</b>
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
							<div class="flex" style="word-break: break-all;" >
								<span v-if="item?.message?.text">{{item?.message?.text}}</span>
								<span v-if="item?.message?.files?.length>0" v-for="(file,idx) in item?.message?.files">
									<img v-if="chatFileType(file.contentType) == 'image'" :src="getUrl(file, item?.sender)"></img>
									<audio v-else-if="chatFileType(file.contentType) == 'audio'" :src="getUrl(file, item?.sender)" class="audio-player" controls></audio>
									<video v-else-if="chatFileType(file.contentType) == 'video'" :src="getUrl(file, item?.sender)" width="400px" controls></video>
									<accept-file v-else :src="getUrl(file, item?.sender)" :size="file?.size" :contentType="file.contentType" :fileName="file.name">
										<img slot="icon" :src="extIcon(file.contentType)" width="40px" height="40px"/>
										<div slot="title">{{file.name}}</div>
										<div style="font-size:8pt;opacity:0.7" slot="attrs">
											{{bitUnit(file.size)}}
										</div>
									</accept-file>
								</span>
							</div>
						</div>
					</div>
	    </template>
	</VirtualScroller>
	<div class="p-4 text-center opacity-60" v-else>
		<i class="pi pi-box mr-2"/>{{t('No Message.')}}
	</div>
</template>

<style lang="scss" scoped>
	:deep(th.p-datepicker-weekday-cell){
		text-align: center !important;
	}
</style>