<script setup>
import { ref, onMounted,onBeforeUnmount, onActivated, watch, computed } from "vue";
import { useStore } from 'vuex';
import { getItem, setItem, pushItem } from "@/utils/localStore";
import confirm from "@/utils/confirm";
import { dayjs, extend } from '@/utils/dayjs';
import BotService from '@/service/BotService';
import { useI18n } from 'vue-i18n';
const { t, locale } = useI18n();
extend(locale.value)
const store = useStore();
const props = defineProps(['room']);
const emits = defineEmits(['back','ep','clear']);
const windowWidth = ref(window.innerWidth);
const isMobile = computed(() => windowWidth.value<=768);
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
	getItem(`bot-replay-${selectedMesh.value?.name}`,(res)=>{
		replays.value = res || {};
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
			setItem(`bot-replay-${selectedMesh.value?.name}`,[],(res)=>{
				loaddata();
			});
			setItem(`bot-history-${selectedMesh.value?.name}`,[],(res)=>{
				emits('clear')
			});
		},
		reject: () => {
		}
	});
}

const replay = (index) => {
	if(!replays.value[index].loading){
		replays.value[index].loading = true;
		replays.value[index].toolcalls.forEach((t)=>{
			t.data=null;
		})
		// botService.replayToolcalls(replays.value[index]).then((resp)=>{
		// 	replays.value[index].loading = false;
		// 	replays.value[index].toolcalls = resp;
		// })
	} else {
		loaddata();
		replays.value[index].loading = false;
	}
}
const args = computed(() => (tc) => {
	try{
		return JSON.parse(tc.tool_call[tc.tool_call?.type]?.arguments);
	}catch(e){
		return {}
	}
})
const args_key = computed(() => (tc) => {
	try{
		return Object.keys(JSON.parse(tc.tool_call[tc.tool_call?.type]?.arguments));
	}catch(e){
		return []
	}
})
onMounted(()=>{
	loaddata();
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
						<ul class="px-4" style="list-style: none;">
							<li class="mb-2" v-for="(tc,idx) in item.toolcalls" :key="idx">
								<div v-if="tc?.tool_call">
									<Fieldset class="innerset" :collapsed="true" :toggleable="true">
											<template #legend="{ toggleCallback }">
												<div class="flex items-center p-2 pointer" @click="toggleCallback">
													<Badge style="width: 18px;" class="mr-2" :value="tc.tool_call?.index"/>
													<b class="pr-2 relative flex-item" style="top:2px">{{tc.tool_call[tc.tool_call?.type]?.name.split('___')[0]}} ( {{args_key(tc).length}} {{t('Args')}} )</b>
													<i class="pi pi-angle-down relative" style="top:4px;right:5px"/>
												</div>
											</template>
											<p class="mt-2 mx-0 mb-0">
												<div class="pl-2 m-1" :key="pi" v-for="(pk,pi) in args_key(tc)">
													<span> - {{pk}}</span>: <Tag size="small" severity="secondary">{{args(tc)[pk]}}</Tag>
												</div>
											</p>
									</Fieldset>
								</div>
								<div class="mt-2 mb-4" v-if="tc?.data">
									<Tag v-for="(msg) in tc?.data?.content||[]">{{msg?.text}}</Tag>
								</div>
								<ProgressBar v-else mode="indeterminate" style="height: 6px"></ProgressBar>
							
							</li>
						</ul>
					
					</Fieldset>
				</template>
				<template #footer>
					<Button :severity="item.loading?'danger':'secondary'" class="w-full" @click="replay(options?.index)" >
						<i :class="item.loading?'pi pi-stop-circle':'pi pi-replay'"/>
						{{item.loading?t('Stop'):t('Replay')}}
					</Button>
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
</style>