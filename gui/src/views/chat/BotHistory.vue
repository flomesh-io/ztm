<script setup>
import { ref, onMounted,onBeforeUnmount, onActivated, watch, computed } from "vue";
import { useStore } from 'vuex';
import { getItem, setItem, pushItem, deleteItem,STORE_BOT_REPLAY,STORE_BOT_HISTORY,STORE_BOT_CONTENT } from "@/utils/localStore";
import confirm from "@/utils/confirm";
import { getKeywordIcon } from '@/utils/file';
import { dayjs, extend } from '@/utils/dayjs';
import BotService from '@/service/BotService';
import { useI18n } from 'vue-i18n';
import ToolCallCard from "./ToolCallCard.vue"
import { isMobileWidth } from '@/utils/platform';
const { t, locale } = useI18n();
extend(locale.value)
const store = useStore();
const props = defineProps(['room']);
const emits = defineEmits(['back','ep','clear','update:room']);
const isMobile = computed(isMobileWidth);
const windowHeight = ref(window.innerHeight);
const viewHeight = computed(() => windowHeight.value - (isMobile.value?43:30));
const today = ref(new Date());
const replays = ref([]);

const botService = new BotService();
const loading = ref(false);
const saving = ref(false);
const selectedMesh = computed(() => {
	return store.getters["account/selectedMesh"]
});

const back = () => {
	emits('back')
}
const timeago = computed(() => (ts) => {
	const date = new Date(ts);
	return dayjs(date).fromNow();
})

const loaddata = () => {
	getItem(STORE_BOT_REPLAY(selectedMesh.value?.name,props?.room?.id),(res)=>{
		replays.value = res || [];
		replays.value.forEach((r)=>{
			r.loading = false;
		})
	});
}
const clear = () => {
	confirm.custom({
		message: `Are you sure to clear this history?`,
		header: 'Tip',
		icon: 'pi pi-info-circle',
		accept: () => {
			setItem(STORE_BOT_REPLAY(selectedMesh.value?.name,props?.room?.id),[],(res)=>{
				loaddata();
			});
			setItem(STORE_BOT_CONTENT(selectedMesh.value?.name,props?.room?.id),[],(res)=>{});
			setItem(STORE_BOT_HISTORY(selectedMesh.value?.name,props?.room?.id),[],(res)=>{
				emits('clear')
			});
		},
		reject: () => {
		}
	});
}
const delReplay = (index) => {
	deleteItem(STORE_BOT_REPLAY(selectedMesh.value?.name,props?.room?.id),index,()=>{
		loaddata();
	})
}
const makeReplay = (index) => {
	if(!replays.value[index].loading){
		replays.value[index].loading = true;
		replays.value[index].toolcalls.forEach((t)=>{
			t.data=null;
		})
		botService.replayToolcalls(replays.value[index].toolcalls||[]).then((resp)=>{
			setTimeout(()=>{
				replays.value[index].loading = false;
				replays.value[index].toolcalls = resp;
			},1000);
		})
	} else {
		loaddata();
		replays.value[index].loading = false;
	}
}
onMounted(()=>{
	loaddata();
})
defineExpose({
	loaddata
})
</script>
<template>
	
	<AppHeader :back="back" >
	    <template #center>
	      <b>{{t('Replay')}}</b>
	    </template>
	    <template #end> 
				<Button v-tooltip="t('Clear History')" :loading="loading" icon="pi pi-trash"  severity="danger" text  @click="clear"/>
			</template>
	</AppHeader>
	<VirtualScroller :delay="50" v-if="replays&&replays.length>0" :items="replays" :itemSize="50" class="border border-surface-200 dark:border-surface-700 w-full" :style="`height:${viewHeight}px`">
		<template v-slot:item="{ item, options }">
			<Card class="m-3">
				<template #content>
					<Fieldset :collapsed="true" :toggleable="true">
						<template #legend="{ toggleCallback }">
							<div class="text-sm p-3 flex pointer"  @click="toggleCallback">
								<div><i class="pi pi-code relative mr-2 text-primary" style="top:2px;"/> {{item.message}}</div>
								<i class="pi pi-angle-double-down relative" style="top:2px;"/>
							</div>
						</template>
						<ToolCallCard v-model:toolcalls="item.toolcalls" :isHistory="true"/>
					</Fieldset>
				</template>
				<template #footer>
						<InputGroup>
							<Button class="w-2" @click="loaddata" icon="pi pi-replay" severity="secondary"/>
							<Button :severity="item.loading?'danger':'secondary'" class="w-full" @click="makeReplay(options?.index)" >
								<i :class="item.loading?'pi pi-stop-circle':'pi pi-caret-right'"/>
								<span v-if="item.loading">{{t('Stop')}}</span>
								<span v-else-if="!!item?.date">{{timeago(item.date)}} {{t('Replay')}}</span>
								<span v-else>{{t('Replay')}}</span>
							</Button>
							<Button class="w-2" @click="delReplay(options?.index)" icon="pi pi-times" severity="secondary"/>
						</InputGroup>
				</template>
			</Card>
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
	:deep(.p-fieldset){
		padding:0;
		// background-color: var(--surface-subground);
		border-width: 0;
	}
	:deep(.p-fieldset-legend){
		border-radius: 0;
		width: 100%;
		margin: 0 !important;
	}
	.innerset :deep(.p-fieldset-legend){
		background-color: var(--surface-subground);
	}
	:deep(.p-card-body){
		gap:0 !important;
	}
	.argList{
		border-style: none dashed none dashed;
		border-color: var(--surface-border);
	}
	:deep(.p-inputgroup){
		border-radius: 0 0 10px 10px;
		overflow: hidden;
	}
	:deep(.p-inputgroup .p-button){
		height:42px;
	}
</style>