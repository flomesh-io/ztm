<script setup>
import { ref, onMounted,onBeforeUnmount, onActivated, watch, computed } from "vue";
import { useStore } from 'vuex';
import confirm from "@/utils/confirm";
import { getKeywordIcon } from '@/utils/file';
import { dayjs, extend } from '@/utils/dayjs';
import { useI18n } from 'vue-i18n';
const { t, locale } = useI18n();
const store = useStore();
const props = defineProps(['toolcalls','isHistory']);
const emits = defineEmits(['update:toolcalls']);
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
</script>
<template>
	<ul v-if="props.isHistory" class="px-4 list-style-none">
		<li class="mb-2" v-for="(tc,idx) in props.toolcalls" :key="idx">
			<div v-if="tc?.tool_call">
				<Fieldset class="innerset" :collapsed="true" :toggleable="true">
						<template #legend="{ toggleCallback }">
							<div class="flex items-center p-2 pointer" @click="toggleCallback">
								<div>
									<Badge class="badge-padding-0" size="small" :value="tc.tool_call?.index+1"/>
								</div>
								<div class="flex-item relative pl-2 relative-top-n2">
									<img :src="getKeywordIcon(tc.tool_call[tc.tool_call?.type]?.name.split('___')[1], 'mcp')" width="20px" height="20px" class="relative mr-1 relative-top-4"/>
									<b class="pr-2 " >{{tc.tool_call[tc.tool_call?.type]?.name.split('___')[0]}} ( {{args_key(tc).length}} {{t('Args')}} )</b>
								</div>
								<i class="pi pi-angle-down relative relative-top-4-right5"/>
							</div>
						</template>
						<p class="mt-2 mx-0 mb-0 argList">
							<div class="pl-2 m-1" :key="pi" v-for="(pk,pi) in args_key(tc)">
								<span>{{pk}}</span> : <TagInput v-if="tc.tool_call[tc.tool_call?.type]?.arguments" v-model:obj="tc.tool_call[tc.tool_call.type]" :k="pk"/>
							</div>
						</p>
				</Fieldset>
			</div>
			<div class="mt-2 mb-4" v-if="tc?.data">
				<Message v-tooltip="msg?.text" class="word-break-all" v-for="(msg) in tc?.data?.content||[]" severity="success" icon="pi pi-check">
					{{msg?.text.length>150?(msg?.text?.substr(0,150)+'...'):msg?.text}}
				</Message>
			</div>
			<ProgressBar v-else-if="props.isHistory" mode="indeterminate" class="progressbar-thin"></ProgressBar>
		
		</li>
	</ul>
	<ul v-else class="px-4 list-style-none">
		<li class="mb-2" v-for="(tool_call,idx) in props.toolcalls" :key="idx">
			<Fieldset class="innerset" :collapsed="true" :toggleable="true">
					<template #legend="{ toggleCallback }">
						<div class="flex items-center p-2 pointer" @click="toggleCallback">
							<div>
								<Badge class="badge-padding-0" size="small" :value="tool_call?.index+1"/>
							</div>
							<div class="flex-item relative pl-2 relative-top-n2">
								<img :src="getKeywordIcon(tool_call[tool_call?.type]?.name.split('___')[1], 'mcp')" width="20px" height="20px" class="relative mr-1 relative-top-4"/>
								<b class="pr-2 " >{{tool_call[tool_call?.type]?.name.split('___')[0]}} ( {{args_key({tool_call}).length}} {{t('Args')}} )</b>
							</div>
							<i class="pi pi-angle-down relative relative-top-4-right5"/>
						</div>
					</template>
					<p class="mt-2 mx-0 mb-0 argList">
						<div class="pl-2 m-1" :key="pi" v-for="(pk,pi) in args_key({tool_call})">
							<span>{{pk}}</span> : <TagInput v-if="tool_call[tool_call?.type]?.arguments" v-model:obj="tool_call[tool_call.type]" :k="pk"/>
						</div>
					</p>
			</Fieldset>
		</li>
	</ul>				
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