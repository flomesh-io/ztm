<script setup>
import { ref, onMounted,onBeforeUnmount, onActivated, watch, computed } from "vue";
import { useStore } from 'vuex';
import confirm from "@/utils/confirm";
import BotService from '@/service/BotService';
import MCPService from '@/service/MCPService';
import _ from 'lodash';
import { openFolder } from '@/utils/file';
import { isPC } from '@/utils/platform';
import llmSvg from "@/assets/img/llm/deepseek.png";
import { getKeywordIcon } from "@/utils/file";
import { useI18n } from 'vue-i18n';
import { getItem, setItem } from "@/utils/localStore";
const { t, locale } = useI18n();
const store = useStore();
const botService = new BotService();
const mcpService = new MCPService();

const emits = defineEmits(['back','history','saved']);
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
const openBox = () => {
	const mesh = selectedMesh.value?.name;
	const base = props.llm?.name;
	openFolder(`ztmChat/${mesh}/${base}`)
}

const mcp = ref(null);
const llm = ref(null);
const loadllm = () => {
	botService.checkLLM((res) => {
		llm.value = res
	});
}
const localMcps = ref([]);
const loadLocalMcp = () => {
	getItem(`mcp-${selectedMesh.value?.name}`,(res)=>{
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
			service: mcp.value
		}).then(()=>{
			localMcps.value.push({...mcp.value, enabled: false});
			setItem(`mcp-${selectedMesh.value?.name}`, localMcps.value, ()=>{})
			setTimeout(()=>{
				mcp.value = null;
				adding.value = false;
			},600)
		}).catch((e)=>{
			adding.value = false;
		})
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
	const path = `${llm.value?.kind}/${llm.value?.name}`;
	
	setItem(`llm-${selectedMesh.value?.name}`, [llm.value], ()=>{})
	setItem(`mcp-${selectedMesh.value?.name}`, localMcps.value, ()=>{});
	const mcps = localMcps.value.filter((n)=> n.enabled);
	
	if(!llm.value.localRoutes?.length){
		botService.createRoute({
			ep: selectedMesh.value?.agent?.id,
			path,
			service: llm.value
		}).then(()=>{
			//emit to chat
			setTimeout(()=>{
				saving.value = false;
				emits('saved',{
					llm: llm.value,
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
				llm: llm.value,
				mcps
			});
			saving.value = false;
		},600);
	}
}
const llms = ref([]);
const mcps = ref([]);
const clear = () => {
	confirm.custom({
			message: `Are you sure to clear this history message?`,
			header: 'Tip',
			icon: 'pi pi-info-circle',
			accept: () => {
				setItem(`bot-history-${selectedMesh.value?.name}`,[],(res)=>{
					emits('clear')
				});
			},
			reject: () => {
			}
	});
	
}
onMounted(()=>{
	loadllm();
	loadLocalMcp();
	botService.getServices().then((res)=>{
		llms.value = (res?.services||[]).filter((n)=>n.kind == 'llm');
		mcps.value = (res?.services||[]).filter((n)=>n.kind == 'tool');
	})
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
				<Select v-model="llm" :options="llms" optionLabel="name" :placeholder="t('Select a LLM')" class="selector" >
					<template #value="slotProps">
						<div v-if="slotProps.value" class="flex items-center">
							<img :src="llmSvg" width="18px" height="18px" class="relative mr-1" style="top:4px"/>
							<div>{{ slotProps.value.name }}</div>
						</div>
						<span v-else>
							{{ slotProps.placeholder }}
						</span>
					</template>
					<template #option="slotProps">
						<div class="flex items-center">
							<img :src="llmSvg" width="18px" height="18px" class="relative mr-1" style=""/>
							<div>{{ slotProps.option.name }}</div>
						</div>
					</template>
				</Select>
				
			</div>
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
			<b class="opacity-70">{{t('MCP Server')}}</b>
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
		<!-- <li class="nav-li flex" @click="history">
			<b class="opacity-70">{{t('History')}}</b>
			<div class="flex-item">
				
			</div>
			<i class="pi pi-angle-right"/>
		</li>
		<li v-if="hasPC" class="nav-li flex" @click="openBox">
			<b class="opacity-70">{{t('Files')}}</b>
			<div class="flex-item">
			</div>
			<i class="pi pi-external-link"/>
		</li> -->
	</ul>
	<div class="p-3" >
			<Button class="w-full"  severity="secondary" @click="clear">
				{{t('Clear History')}}
			</Button>
	</div>
</template>
<style scoped>
	.selector{
		line-height: 26px;border: none;background-color: transparent;box-shadow: none;
	}
</style>