<script setup>
import { ref, onMounted,onBeforeUnmount, onActivated, watch, computed } from "vue";
import { useStore } from 'vuex';
import BotService from '@/service/BotService';
import MCPService from '@/service/MCPService';
import _ from 'lodash';
import { openFolder, getKeywordIcon } from '@/utils/file';
import { isPC } from '@/utils/platform';
import { useI18n } from 'vue-i18n';
import { getItem, setItem, STORE_SETTING_LLM,STORE_BOT_PROMPT, STORE_SETTING_MCP } from "@/utils/localStore";
const { t, locale } = useI18n();
const store = useStore();
const botService = new BotService();
const mcpService = new MCPService();

const props = defineProps(['room']);
const emits = defineEmits(['back','history','saved','update:room']);
const selectedMesh = computed(() => {
	return store.getters["account/selectedMesh"]
});
const visibleUserSelector = ref(false);

const hasPC = computed(()=> isPC());

const loading = ref(false);
const saving = ref(false);

const back = () => {
	emits('back')
}
const llmName = ref('');
const history = () => {
	emits('history');
}

const mcp = ref(null);
const llm = ref(null);
const llms = ref([]);
const matchLLM = computed(()=>{
	return llms.value.find((l) => l.name == llm.value)
})
const immediate = ref(false);
const memoryLength = ref(10);
const loadllm = () => {
	botService.checkLLM(props?.room?.id,(res) => {
		llm.value = res?.name;
		immediate.value = res?.immediate || false;
		memoryLength.value = res?.memoryLength || 10;
	});
}
const localMcps = ref([]);
const loadLocalMcp = () => {
	getItem(STORE_SETTING_MCP(selectedMesh.value?.name,props?.room?.id),(res)=>{
		localMcps.value = res || [];
	});
}
const adding = ref(false);
const removeAry = ref([]);
const remMcp = (idx) => {
	removeAry.value.push({...localMcps.value[idx]});
	localMcps.value.splice(idx,1);
}
const addMcp = () => {
	adding.value = true;
	const path = `${mcp.value?.kind}/${mcp.value?.name}`;
	if(!mcp.value.localRoutes?.length){
		botService.createRoute({
			ep: selectedMesh.value?.agent?.id,
			path,
			service: mcp.value,
			cors:{
				allowOrigins: ['tauri://localhost','http://localhost:1420','http://localhost:7777'],
				// allowHeaders: ['content-type','mcp-session-id']
			}
		}).then(()=>{
			localMcps.value.push({...mcp.value, enabled: true});
			setItem(STORE_SETTING_MCP(selectedMesh.value?.name,props?.room?.id), localMcps.value, ()=>{})
			setTimeout(()=>{
				mcp.value = null;
				adding.value = false;
			},600)
		}).catch((e)=>{
			adding.value = false;
		})
	} else {
		localMcps.value.push({...mcp.value, enabled: true});
		setItem(STORE_SETTING_MCP(selectedMesh.value?.name,props?.room?.id), localMcps.value, ()=>{})
		setTimeout(()=>{
			mcp.value = null;
			adding.value = false;
		},600)
	}
}
const makeRemoveMcpRoute = () => {
	//make remove route
	if(removeAry.value.length>0){
		for(let i = (removeAry.value.length-1);i>=0;i--){
			botService.deleteRoute({
				ep: selectedMesh.value?.agent?.id,
				path: `${removeAry.value[i]?.kind}/${removeAry.value[i]?.name}`,
			})
			removeAry.value.splice(i,1);
		}
	}
}
const save = () => {
	saving.value = true;
	const path = `${matchLLM.value?.kind}/${llm.value}`;
	
	setItem(STORE_SETTING_LLM(selectedMesh.value?.name,props?.room?.id), [{
		...matchLLM.value,
		immediate:immediate.value,
		memoryLength:memoryLength.value
	}], ()=>{})
	setItem(STORE_SETTING_MCP(selectedMesh.value?.name,props?.room?.id), localMcps.value, ()=>{});
	const mcps = localMcps.value.filter((n)=> n.enabled);
	
	if(!matchLLM.value?.localRoutes?.length){
		botService.createRoute({
			ep: selectedMesh.value?.agent?.id,
			path,
			service: matchLLM.value
		}).then(()=>{
			//emit to chat
			setTimeout(()=>{
				saving.value = false;
				emits('saved',{
					llm: matchLLM.value,
					mcps
				});
			},600);
			makeRemoveMcpRoute()
		}).catch((e)=>{
			saving.value = false;
		})
	} else {
		makeRemoveMcpRoute();
		//emit to chat
		setTimeout(()=>{
			emits('saved',{
				llm: matchLLM.value,
				mcps
			});
			saving.value = false;
		},600);
	}
}
const mcps = ref([]);
const openPrompt = ref(false);
const prompts = ref({
	system: '',
	user: '',
	tool: ''
})
const showPrompt = () => {
	openPrompt.value = true;

}
const savePrompt = () => {
	const dftPrompt = botService.getDefaultPrompt();
	setItem(STORE_BOT_PROMPT(selectedMesh.value?.name,props?.room?.id), [
		prompts.value.user || dftPrompt.user,
		prompts.value.system || dftPrompt.system,
		prompts.value.tool || dftPrompt.tool,
	], ()=>{
		openPrompt.value = false;
	})
	
}
onMounted(()=>{
	loadllm();
	loadLocalMcp();
	botService.getServices().then((res)=>{
		llms.value = (res?.services||[]).filter((n)=>n.kind == 'llm');
		mcps.value = (res?.services||[]).filter((n)=>n.kind == 'tool');
	});
	botService.getPrompt(props?.room?.id).then((res)=>{
		prompts.value = res
	});
	
	
})
</script>
<template>
	<AppHeader :back="back">
	    <template #center>
	      <b>{{t('Bot Setting')}}</b>
	    </template>
	    <template #end> 
				<Button @click="save" :loading="saving" icon="pi pi-check"  severity="secondary" text />
			</template>
	</AppHeader>
	<ul class="nav-ul" >
		<li class="nav-li flex" >
			<b class="opacity-70">{{t('LLM')}}</b>
			<div class="flex-item text-right pr-2">
				<Select v-model="llm" :options="llms" optionLabel="name" optionValue="name" :placeholder="t('Select a LLM')" class="selector" >
					<template #value="slotProps">
						<div v-if="slotProps.value" class="flex items-center">
							<img :src="getKeywordIcon(slotProps.value, 'llm')" width="18px" height="18px" class="relative mr-1" style="top:4px"/>
							<div>{{ slotProps.value }}</div>
						</div>
						<span v-else>
							{{ slotProps.placeholder }}
						</span>
					</template>
					<template #option="slotProps">
						<div class="flex items-center">
							<img :src="getKeywordIcon(slotProps.option.name, 'llm')" width="18px" height="18px" class="relative mr-1"/>
							<div>{{ slotProps.option.name }}</div>
						</div>
					</template>
				</Select>
				
			</div>
		</li>
		<li class="nav-li flex" >
			<b class="opacity-70">{{t('Memory Length')}}</b>
			<div class="flex-item text-right pr-3">
				<InputNumber :min="10" :max="50" placeholder="10-50" v-model="memoryLength" />
			</div>
		</li>
		<li class="nav-li flex" >
			<b class="opacity-70">{{t('Execute')}}</b>
			<div class="flex-item text-right pr-3">
				<span>{{immediate?t('Immediate'):t('Every Time Confirm')}}</span>
			</div>
			<div class="px-2">
				<ToggleSwitch class="relative" style="top:5px" v-model="immediate" />
			</div>
		</li>
		<li class="nav-li flex" >
			<b class="opacity-70">{{t('Prompts')}}</b>
			<div class="flex-item text-right pr-3">
			</div>
			<Button icon="pi pi-pencil" severity="secondary" @click="showPrompt"/>
		</li>
		<li class="nav-li flex" v-for="(localMcp,idx) in localMcps">
			<b class="opacity-70">{{t('MCP Server')}}</b>
			<div class="flex-item text-right pr-3">
				<img :src="getKeywordIcon(localMcp.name, 'mcp')" width="18px" height="18px" class="relative mr-1" style="top:4px"/>
				<span>{{ localMcp.name }}</span>
			</div>
			<div class="px-2">
				<ToggleSwitch class="relative" style="top:5px" v-model="localMcp.enabled" />
			</div>
			<Button icon="pi pi-trash" severity="secondary" @click="remMcp(idx)"/>
		</li>
		<li class="nav-li flex" >
			<b class="opacity-70">{{t('Add MCP')}}</b>
			<div class="flex-item text-right">
				<Select v-model="mcp" :options="mcps" optionLabel="name" :placeholder="t('Select a tool')" class="selector" >
					<template #value="slotProps">
						<div v-if="slotProps.value" class="flex items-center">
							<img :src="getKeywordIcon(slotProps.value.name, 'mcp')" width="18px" height="18px" class="relative mr-1" style="top:4px"/>
							<div>{{ slotProps.value.name }}</div>
						</div>
						<span v-else>
							{{ slotProps.placeholder }}
						</span>
					</template>
					<template #option="slotProps">
						<div class="flex items-center">
							<img :src="getKeywordIcon(slotProps.option.name, 'mcp')" width="18px" height="18px" class="relative mr-1" style=""/>
							<div>{{ slotProps.option.name }}</div>
						</div>
					</template>
				</Select>
			</div>
			<Button :disabled="!mcp" :loading="adding" icon="pi pi-plus" severity="secondary" @click="addMcp"/>
		</li>
	</ul>
	
	<Dialog class="noheader" v-model:visible="openPrompt" modal :style="{ minHeight:'400px',minWidth:'400px'  }">
		<AppHeader :back="() => openPrompt = false" :main="false">
				<template #center>
					<b>{{t('Prompts')}}</b>
				</template>
				<template #end> 
					<Button icon="pi pi-check" @click="savePrompt" />
				</template>
		</AppHeader>
		<div class="px-2 mt-2">
			<Tag class="mb-2">{{t('User')}}</Tag>
			<Chip class=" mb-2 align-items-top teatarea-panel w-full"  >
					<span class="font-medium">
						<Textarea :placeholder="t('Prompt')+'...'" v-model="prompts.user" :autoResize="false" rows="5" />
					</span>
				</Chip>
		</div>
		<div class="px-2">
			<Tag class="mb-2">{{t('System')}}</Tag>
				<Chip class="mb-2 align-items-top teatarea-panel w-full"  >
					<span class="font-medium">
						<Textarea :placeholder="t('Prompt')+'...'" v-model="prompts.system" :autoResize="false" rows="11" />
					</span>
				</Chip>
		</div>
		<div class="px-2">
			<Tag class="mb-2">{{t('Tool')}}</Tag>
				<Chip class="mb-2 align-items-top teatarea-panel w-full"  >
					<span class="font-medium">
						<Textarea :placeholder="t('Prompt')+'...'" v-model="prompts.tool" :autoResize="false" rows="4" />
					</span>
			</Chip>	
		</div>
		
	</Dialog>
</template>
<style scoped>
	.selector{
		line-height: 26px;border: none;background-color: transparent;box-shadow: none;
	}
</style>