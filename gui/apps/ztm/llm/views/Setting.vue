<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { merge } from '@/service/common/request';
import JsonEditor from '@/components/editor/JsonEditor.vue';
import LLMService from '../service/LLMService';
import { selectDir } from '@/utils/file';
import { useRoute } from 'vue-router'
import ClipboardJS from "clipboard";
import { useStore } from 'vuex';
import _ from "lodash"
import toast from "@/utils/toast";
import { getKeywordIcon } from "@/utils/file";
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
const emits = defineEmits(['save']);
const store = useStore();
const route = useRoute();
const llmService = new LLMService();
const info = computed(() => {
	return store.getters['app/info']
});
const loading = ref(false);
const svcloading = ref(false);
const newMcp = {
	name: '',
	protocol: 'mcp',
	metainfo: {
		version: '',
		provider: '',
		description: ''
	},
	target: {
		address: '',
		argv: [],
		env: {},
		headers: {
			"Sec-Fetch-Site": "same-site"
		}
	}
}
const transport = ref('http');
const mcp = ref(_.cloneDeep(newMcp))
const mcps = ref([])
const allMcps = ref([])
const newLlm = {
	name: '',
	protocol: 'http',
	metainfo: {
		version: '',
		provider: '',
		description: ''
	},
	target: {
		address: 'https://api.siliconflow.cn/v1',//'https://api.siliconflow.cn/v1/chat/completions',
		headers: {
			Authorization: 'Bearer <token>',
			"Content-Type": "application/json",
			"origin": "localhost"
		},
		body: {
			"model": "Pro/deepseek-ai/DeepSeek-V3",
			"stream": true,
			"max_tokens": 512,
			"enable_thinking": false,
			"thinking_budget": 512,
			"min_p": 0.05,
			"stop": null,
			"temperature": 0.1,
			"top_p": 0.7,
			"top_k": 50,
			"frequency_penalty": 0.5,
			"n": 1,
			"response_format": {
				"type": "text"
			},
		}
	}
}
const llm = ref(_.cloneDeep(newLlm))
const llms = ref([]);
const allLlms = ref([]);
const routes = ref([]);
const llmEnabled = computed(() => {
	return !!llm.value.name;
});
const mcpEnabled = computed(() => {
	return !!mcp.value.name;
});

const error = ref();
const llmEditor = ref(false);
const mcpEditor = ref(false);
const savingLlm = ref(false);
const createLlm = () => {
	savingLlm.value = true
	const _svc = {
		kind: 'llm',
		name: llm.value.name,
		ep: info?.value.endpoint?.id,
		body: {
			...llm.value
		}
	}
	llmService.createService(_svc).then(()=>{
		toast.add({ severity: 'success', summary:t('Tips'), detail: t('Save successfully.'), life: 3000 });
		savingLlm.value = false;
		llmEditor.value = false;
		routeCreate({
			name: _svc.name,
			kind: _svc.kind,
			protocol: _svc.protocol,
			metainfo: _svc.body?.metainfo||{},
			endpoint: {id:_svc.ep},
		});
		loaddata();
	}).catch((e)=>{
		savingLlm.value = false;
		llmEditor.value = false;
	})
}
const savingMcp = ref(false);
const createMcp = () => {
	savingMcp.value = true
	const _svc = {
		kind: 'tool',
		name: mcp.value.name,
		ep: info?.value.endpoint?.id,
		body: {
			...mcp.value
		}
	}
	llmService.createService(_svc).then((res)=>{
		toast.add({ severity: 'success', summary:t('Tips'), detail: t('Save successfully.'), life: 3000 });
		savingMcp.value = false;
		mcpEditor.value = false;
		routeCreate({
			name: _svc.name,
			kind: _svc.kind,
			protocol: _svc.protocol,
			metainfo: _svc.body?.metainfo||{},
			endpoint: {id:_svc.ep},
		});
		loaddata();
	}).catch((e)=>{
		savingMcp.value = false;
		mcpEditor.value = false;
	})
}
let clipboard = null;
const loadsvc = () => {
	
}
const loaddata = () => {
	loading.value = true;
	svcloading.value = true;
	llmService.getServices(info?.value.endpoint?.id).then((resp)=>{
		const res = resp||[];
		llms.value = res.filter((n) => n.kind == 'llm');
		mcps.value = res.filter((n) => n.kind == 'tool');
		svcloading.value = false;
	})
	
	llmService.getRoutes(info?.value.endpoint?.id).then((res)=>{
		routes.value = res.routes||[];
		
		llmService.getServices().then((res)=>{
			const services = res?.services||[];
			services.forEach((svc)=>{
				if(!svc.localRoutes){
					svc.localRoutes=[]
				}
				svc.localRoutes.forEach((route,i)=>{
					svc.localRoutes[i] = routes.value.find((r) => r.path == route.path);
					svc.localRoutes[i].find = true;
					if(svc.localRoutes[i]){
						if(!svc.localRoutes[i].cors){
							svc.localRoutes[i].cors = {}
						}
						if(!svc.localRoutes[i].cors.allowOrigins){
							svc.localRoutes[i].cors.allowOrigins = []
						}
						if(!svc.localRoutes[i].cors.allowHeaders){
							svc.localRoutes[i].cors.allowHeaders = []
						}
						if(!svc.localRoutes[i].cors.allowMethods){
							svc.localRoutes[i].cors.allowMethods = []
						}
					}
				})
			})
			allLlms.value = services.filter((n) => n.kind == 'llm').sort((a,b)=>{
				return b.localRoutes?.length - a.localRoutes?.length
			});
			allMcps.value = services.filter((n) => n.kind == 'tool').sort((a,b)=>{
				return b.localRoutes?.length - a.localRoutes?.length
			});
			loading.value = false;
			setTimeout(()=>{
				clipboard = new ClipboardJS(".copy-btn");
				clipboard.on("success", (e) => {
					toast.add({ severity: 'success', summary: 'Tips', detail: "Copied", life: 3000 });
				});
				clipboard.on("error", (e) => {
					toast.add({ severity: 'error', summary: 'Tips', detail: "Copy failed", life: 3000 });
				});
			},300)
		})
	})
}


const openLlmCreate = () => {
	llmEditor.value = true;
	llm.value = _.cloneDeep(newLlm);
}
const openMcpCreate = () => {
	mcpEditor.value = true;
	mcp.value = _.cloneDeep(newMcp);
}

const openLlmEdit = (t,index) => {
	llmEditor.value = true;
	llmService.getService(info?.value.endpoint?.id,{
		...t
	}).then((res)=>{
		llm.value = res;
	})
	// llm.value = _.cloneDeep(t);
}
const openMcpEdit = (t,index) => {
	mcpEditor.value = true;
	mcp.value = _.cloneDeep(t);
	transport.value = mcp.value?.target?.address.indexOf("://")>=0?'http':'stdio'
}
const llmRemove = (t,index) => {
	llmService.deleteService({
		ep:info?.value.endpoint?.id, kind:'llm', name:t.name
	},()=>{
		loaddata();
		emits("save");
	})
}
const mcpRemove = (t,index) => {
	llmService.deleteService({
		ep:info?.value.endpoint?.id, kind:'tool', name:t.name
	},()=>{
		loaddata();
		emits("save");
	})
}

const savingMap = ref({})
const routeRemove = (t) => {
	savingMap.value[t?.name] = true;
	llmService.deleteRoute({
		ep:info?.value.endpoint?.id, path:t.path
	},()=>{
		savingMap.value[t?.name] = false;
		loaddata();
		emits("save");
	})
}
const detatingAny = ref(false);
const removeAnyRoutes = () => {
	detatingAny.value = true;
	llmService.deleteRouteNoConfirm(
		info?.value.endpoint?.id, routes.value.filter((r)=> !r?.find)||[]
	).then(()=>{
		detatingAny.value = false;
		loaddata();
	})
}
const routeSave = (service, route) => {
	savingMap.value[service?.name] = true;
	llmService.createRoute({
		ep:info?.value.endpoint?.id, path:`${service?.kind}/${service?.name}`,
		service,
		cors:route.cors
	}).then(()=>{
		// savingMap.value[service?.name] = false;
		loaddata();
		emits("save");
	})
}
const routeCreate = (service) => {
	savingMap.value[service?.name] = true;
	llmService.createRoute({
		ep:info?.value.endpoint?.id, path:`${service?.kind}/${service?.name}`,
		service,
		cors:{
			allowOrigins: service?.protocol=='http'?['http://localhost:7777']:['tauri://localhost','http://localhost:1420','http://localhost:7777'],
			// allowHeaders: service?.protocol=='http'?[]:['content-type']
		}
	}).then(()=>{
		setTimeout(()=>{
			savingMap.value[service?.name] = false;
			loaddata();
		},2000)
		emits("save");
	})
}

const browser = () => {
	selectDir((dir)=>{
		mcp.value.target.address = dir;
	})
}
onMounted(() => {
	loaddata()
});
</script>

<template>

	<div class="surface-ground h-full min-h-screen relative ">
		<AppHeader >
				<template #center>
					 <b>{{t('LLM')}}</b>
				</template>
		
				<template #end> 
				</template>
		</AppHeader>
		<ScrollPanel class="absolute-scroll-panel " style="bottom: 0;">
			<Empty v-if="error" :error="error"/>
			<Tabs v-else value="2">
				<TabList>
					<Tab value="2">
						<Tag >{{t('Routes')}}
							<Badge :value="routes.length" />
						</Tag> 
						<Button severity="secondary" class="ml-2" :loading="detatingAny" @click="removeAnyRoutes" v-if="routes.filter((r)=>!r?.find).length>0" size="small" >
							{{t('Clean invalid')}}
							<Badge :value="routes.filter((r)=>!r?.find).length" />
						</Button> 
					</Tab>
					<Tab value="0">
						<Tag >{{t('My LLM')}}
							<Badge :value="llms.length" />
						</Tag> 
					</Tab>
					<Tab value="1">
						<Tag >{{t('My MCP Server')}}
							<Badge :value="mcps.length" />
						</Tag> 
					</Tab>
				</TabList>
				<TabPanels>
					<TabPanel value="0">		
							<Loading v-if="svcloading" />
							<div v-else class="surface-ground surface-section h-full" >
								<h6 class="flex">
									<div class="flex-item">
										<Button 
											v-if="!llmEditor" 
											@click="openLlmCreate" 
										  :label="t('Add LLM')"
											size="small" 
											icon="pi pi-plus" ></Button>
										<div v-else>
											<Button class="mr-2" @click="() => llmEditor = false" size="small" icon="pi pi-angle-left" outlined ></Button>
										</div>
									</div>
									<div class="flex-item text-right">
										<div v-if="llmEditor" >
											<Button :disabled="!llmEnabled" @click="createLlm()" :loading="savingLlm"  size="small" icon="pi pi-check" ></Button>
										</div>
								</div>
								</h6>
								<ul v-if="llmEditor" class="list-none p-0 m-0">
									<FormItem :label="t('Name')" :border="true">
										<Chip class="pl-0 pr-3 mr-2">
												<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<i class="pi pi-bookmark"/>
												</span>
												<span class="ml-2 font-medium">
													<InputText :placeholder="t('Name your LLM')" class="add-tag-input xxl" :unstyled="true" v-model="llm.name" type="text" />
												</span>
										</Chip>
									</FormItem>
									<FormItem :label="t('Url')" :border="false">
										<Chip class="pl-0 pr-3 mr-2">
												<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<i class="pi pi-link"/>
												</span>
												<span class="ml-2 font-medium">
													<InputText :placeholder="t('LLM Address')" class="add-tag-input xxl" style="width: 300px;" :unstyled="true" v-model="llm.target.address" type="text" />
												</span>
										</Chip>
									</FormItem>
									<FormItem :label="t('Headers')" :border="false">
										<ChipMap direction="v" icon="pi-desktop" :placeholder="t('key:value')" v-model:map="llm.target.headers" />
									</FormItem>
									<FormItem :label="t('Body')" :border="false">
										<JsonEditor id="llmBody" height="240px" type="object" v-model:value="llm.target.body"/>
									</FormItem>
									<FormItem :label="t('Description')" :border="false">
										<Textarea class="w-full"  v-model="llm.metainfo.description" rows="2" cols="20" />
									</FormItem>
									
								</ul>
								
								<div v-else class="grid text-left px-1" >
										<div v-if="llms.length>0" :class="'col-12 md:col-6 lg:col-4'" v-for="(item,hid) in llms" :key="hid">
											 <div class="surface-card shadow-2 p-3 border-round">
													 <div class="flex justify-content-between">
															<div class="pr-4">
																<img :src="getKeywordIcon(item?.name, 'llm')" width="30px" />
															</div>
															<div class="flex-item">
																	<span class="block text-tip font-medium mb-3">
																		<Tag severity="contrast" class="mr-2 text-uppercase" v-if="item.kind">{{item.kind}}</Tag>
																		<Tag class="mr-2" v-if="item.metainfo?.version">{{item.metainfo?.version}}</Tag>
																		<b>{{item.name}}</b>
																	</span>
																	<div class="text-left w-full" >
																		{{item?.metainfo?.description||'No description'}}
																	</div>
															</div>
															<div class="flex flex-column">
																	<Button @click="openLlmEdit(item,index)" size="small" icon="pi pi-pencil" class="mb-1"></Button>
																	<Button @click="llmRemove(item,index)" size="small" icon="pi pi-trash" outlined></Button>
															</div>
													 </div>
											 </div>
									 </div>
									 <div class="p-3" v-else>
										 {{t('No LLM.')}}
									 </div>
								</div>
							</div>
					</TabPanel>
					<TabPanel value="1">
							<Loading v-if="svcloading" />
							<div v-else class="surface-ground surface-section h-full" >
								<h6 class="flex">
									<div class="flex-item">
										<Button 
											v-if="!mcpEditor" 
											@click="openMcpCreate" 
											:label="t('Add MCP Server')" 
											size="small" 
											icon="pi pi-plus" ></Button>
										<div v-else >
											<Button class="mr-2" @click="() => mcpEditor = false" size="small" icon="pi pi-angle-left" outlined ></Button>
										</div>
									</div>
									<div class="flex-item text-right">
										<div v-if="mcpEditor" >
											<Button :disabled="!mcpEnabled"  @click="createMcp()" :loading="savingMcp"  size="small" icon="pi pi-check" ></Button>
										</div>
									</div>
								</h6>
								<ul v-if="mcpEditor" class="list-none p-0 m-0">
									<FormItem :label="t('Name')" :border="true">
										<Chip class="pl-0 pr-3 mr-2">
												<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<i class="pi pi-bookmark"/>
												</span>
												<span class="ml-2 font-medium">
													<InputText :placeholder="t('Name your MCP Server')" class="add-tag-input xxl" style="width: 200px;" :unstyled="true" v-model="mcp.name" type="text" />
												</span>
										</Chip>
									</FormItem>
									<FormItem :label="t('Transport Type')" :border="false">
										<Chip class="pl-0 pr-3">
												<span class="border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<RadioButton v-model="transport" inputId="transport1" name="transport" value="stdio" />
												</span>
												<span class="ml-2 font-medium">Stdio</span>
										</Chip>
										<Chip class="ml-2 pl-0 pr-3">
												<span class="border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<RadioButton v-model="transport" inputId="transport2" name="transport" value="http" />
												</span>
												<span class="ml-2 font-medium">SSE/Streamable</span>
										</Chip>
									</FormItem>
									<FormItem :label="t('Url')" :border="false">
										<Chip class="pl-0 pr-3 mr-2">
												<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<i class="pi pi-link"/>
												</span>
												<span class="ml-2 font-medium">
													<InputText :placeholder="t('MCP Server Address')" class="add-tag-input xxl" style="width: 300px;" :unstyled="true" v-model="mcp.target.address" type="text" />
												</span>
												<Button v-if="transport == 'stdio'" style="left:10px;border-radius:16px;" class="relative" size="small" @click="browser" icon="pi pi-folder"></Button>
										</Chip>
									</FormItem>
									<FormItem  v-if="transport == 'stdio'" :label="t('Arguments')" :border="false">
										<ChipList direction="v" icon="pi-desktop" :placeholder="t('Add')" v-model:list="mcp.target.argv" />
									</FormItem>
									<FormItem  v-if="transport == 'stdio'" :label="t('Environment')" :border="false">
										<ChipMap direction="v" icon="pi-desktop" :placeholder="t('Add')" v-model:map="mcp.target.env" />
									</FormItem>
									<FormItem :label="t('Headers')" :border="false">
										<ChipMap direction="v" icon="pi-desktop" :placeholder="t('key:value')" v-model:map="mcp.target.headers" />
									</FormItem>
									<!-- <FormItem :label="t('Body')" :border="false">
										<JsonEditor id="mcpBody" height="140px" type="object" v-model:value="mcp.target.body"/>
									</FormItem> -->
									<FormItem :label="t('Description')" :border="false">
										<Textarea class="w-full"  v-model="mcp.metainfo.description" rows="2" cols="20" />
									</FormItem>
								</ul>
								<div v-else class="grid text-left px-1" >
										<div v-if="mcps.length>0" :class="'col-12 md:col-6 lg:col-4'" v-for="(item,hid) in mcps" :key="hid">
											 <div class="surface-card shadow-2 p-3 border-round">
													 <div class="flex justify-content-between">
															<div class="pr-4">
																<img :src="getKeywordIcon(item.name, 'mcp')" height="30px" />
															</div>
															<div class="flex-item">
																	<span class="block text-tip font-medium mb-3">
																		<Tag severity="contrast" class="mr-2" v-if="item.protocol">
																			{{item?.target?.address.indexOf("://")>=0?'SSE / Streamable':'Stdio'}}
																		</Tag>
																		<Tag class="mr-1" v-if="item.metainfo?.version">{{item.metainfo?.version}}</Tag>
																		<b>{{item.name}}</b>
																	</span>
																	<div class="text-left w-full" >
																		{{item?.metainfo?.description||'No description'}}
																	</div>
															</div>
															<div class="flex flex-column">
																	<Button @click="openMcpEdit(item,index)" size="small" icon="pi pi-pencil" class="mb-1"></Button>
																	<Button @click="mcpRemove(item,index)" size="small" icon="pi pi-trash" outlined></Button>
															</div>
													 </div>
											 </div>
									 </div>
									 <div class="p-3" v-else>
										 {{t('No MCP Server.')}}
									 </div>
								</div>
							</div>
					</TabPanel>
					<TabPanel value="2">
						<Loading v-if="loading" />
						<div v-else class="surface-ground surface-section h-full" >
							
							<div class="grid w-full m-0" >
								<div class="col-12 md:col-6 " >
									<BlockViewer containerClass="surface-section p-3" >
										<div>
											<Tag >{{t('LLM')}}
												<Badge :value="allLlms.length" />
											</Tag> 
										</div>
										<DataView class="transparent" :value="allLlms">
											<template #empty>
												<div class="py-2">{{t('No LLM.')}}</div>
											</template>
											<template #list="slotProps">
												<div class="surface-border py-3" :class="{'border-top-1':index>0}" v-for="(item, index) in slotProps.items" :key="index">
														<div class="flex py-2 gap-4" :class="{ 'border-t border-surface-200 dark:border-surface-700': index !== 0 }">
																<div>
																	<img :src="getKeywordIcon(item?.name, 'llm')" width="30px" />
																</div>
																<div class="flex flex-col pr-2 flex-item w-full">
																	<div class="w-full text-lg font-medium align-items-start flex flex-column" style="justify-content: start;">
																		<div class="flex w-full" style="align-items:center">
																			<Tag class="mr-2 text-uppercase" v-if="item?.kind">{{item?.kind}}</Tag>
																			<b class="flex-item">{{item?.name}}</b>
																			
																			<Button :loading="savingMap[item?.name]" class="mr-2" v-if="item.localRoutes.length > 0" @click="routeRemove(item.localRoutes[0],index)" size="small" icon="pi pi-trash" link></Button>
																			<Button :loading="savingMap[item?.name]" v-if="item.localRoutes.length > 0" @click="routeSave(item, item.localRoutes[0])" size="small" icon="pi pi-check" ></Button>
																			<Button :loading="savingMap[item?.name]" v-if="item.localRoutes.length == 0" @click="routeCreate(item)" size="small" icon="pi pi-plus" ></Button>
																		</div>
																		<span class=" text-sm mt-2"  v-if="item.localRoutes.length>0" v-for="(route) in item.localRoutes">
																			<div class="flex" style="word-break: break-all;align-items:center">
																				<Button link :data-clipboard-text="llmService.getSvcUrl(route?.path)" icon=" pi pi-clipboard" class="copy-btn"/> 
																				<div>{{llmService.getSvcUrl(route?.path)}}</div>
																			</div>
																			<div v-if="route.cors">
																				<div class="flex" style="align-items:center">
																					<Button  class="px-3" link icon=" pi pi-desktop" /> 
																					<span class="pr-2 nowrap">{{t('Allow Origins')}}</span>
																					<ChipList listType="tag" :placeholder="t('Add')" v-model:list="route.cors.allowOrigins" />
																				</div>
																				<!-- <div class="flex" style="align-items:center">
																					<Button link icon=" pi pi-code" /> 
																					<span class="pr-2">{{t('Allow Headers')}}</span>
																					<ChipList listType="tag" :placeholder="t('Add')" v-model:list="route.cors.allowHeaders" />
																				</div>
																				<div class="flex" style="align-items:center">
																					<Button link icon=" pi pi-code" /> 
																					<span class="pr-2">{{t('Allow Methods')}}</span>
																					<ChipList listType="tag" :placeholder="t('Add')" v-model:list="route.cors.allowMethods" />
																				</div> -->
																			</div>
																		</span>
																		<span class="opacity-50 text-sm mt-2" v-else>
																			<i class="pi pi-link text-primary-500 mr-2 "/> {{t('No Routes.')}}
																		</span>
																	</div>
																</div>
														</div>
												</div>
											</template>
										</DataView>
									</BlockViewer>
								</div>
								<div class="col-12 md:col-6" >
								
									<BlockViewer containerClass="surface-section p-3" >
										<div>
											<Tag >{{t('MCP Server')}}
												<Badge :value="allMcps.length" />
											</Tag> 
										</div>
										<DataView class="transparent" :value="allMcps">
											<template #empty>
												<div class="py-2">{{t('No MCP Server.')}}</div>
											</template>
											<template #list="slotProps">
												<div class="surface-border py-3" :class="{'border-top-1':index>0}" v-for="(item, index) in slotProps.items" :key="index">
														<div class="flex py-2 gap-4" :class="{ 'border-t border-surface-200 dark:border-surface-700': index !== 0 }">
																<div>
																	<img :src="getKeywordIcon(item?.name, 'mcp')" width="30px" />
																</div>
																<div class="flex flex-col pr-2 flex-item w-full">
																	<div class="w-full text-lg font-medium align-items-start flex flex-column" style="justify-content: start;">
																		<div class="flex w-full" style="align-items:center">
																			<Tag class="mr-2" v-if="item?.kind">
																				Streamable
																			</Tag>
																			<b class="flex-item">{{item?.name}}</b>
																			
																			<Button :loading="savingMap[item?.name]" class="mr-2" v-if="item.localRoutes.length > 0" @click="routeRemove(item.localRoutes[0],index)" size="small" icon="pi pi-trash" link></Button>
																			<Button :loading="savingMap[item?.name]" v-if="item.localRoutes.length > 0" @click="routeSave(item, item.localRoutes[0])" size="small" icon="pi pi-check" ></Button>
																			<Button :loading="savingMap[item?.name]" v-if="item.localRoutes.length == 0" @click="routeCreate(item)" size="small" icon="pi pi-plus" ></Button>
																		</div>
																		<span class="text-sm mt-2" v-if="item.localRoutes.length>0" v-for="(route) in item.localRoutes">
																			<div class="flex" style="word-break: break-all;align-items:center">
																				<Button link :data-clipboard-text="llmService.getSvcUrl(route?.path)" icon=" pi pi-clipboard" class="copy-btn"/> 
																				<div>{{llmService.getSvcUrl(route?.path)}}</div>
																			</div>
																			<div  v-if="route.cors">
																				<div class="flex" style="align-items:center">
																					<Button class="px-3" link icon=" pi pi-desktop" /> 
																					<span class="pr-2 nowrap">{{t('Allow Origins')}}</span>
																					<ChipList listType="tag" :placeholder="t('Add')" v-model:list="route.cors.allowOrigins" />
																				</div>
																			<!-- 	<div class="flex" style="align-items:center">
																					<Button link icon=" pi pi-code" /> 
																					<span class="pr-2">{{t('Allow Headers')}}</span>
																					<ChipList listType="tag" :placeholder="t('Add')" v-model:list="route.cors.allowHeaders" />
																				</div>
																				<div class="flex" style="align-items:center">
																					<Button link icon=" pi pi-code" /> 
																					<span class="pr-2">{{t('Allow Methods')}}</span>
																					<ChipList listType="tag" :placeholder="t('Add')" v-model:list="route.cors.allowMethods" />
																				</div> -->
																			</div>
																		</span>
																		<span class="opacity-50 text-sm mt-2" v-else>
																			<i class="pi pi-link text-primary-500 mr-2 "/> {{t('No Routes.')}}
																		</span>
																	</div>
																</div>
														</div>
												</div>
											</template>
										</DataView>
									</BlockViewer>
								</div>
							</div>
						</div>
					</TabPanel>
				</TabPanels>	
			</Tabs>
		</ScrollPanel>
	</div>
</template>

<style scoped lang="scss">
:deep(.p-breadcrumb){
	border-radius: 0;
	border-left: none;
	border-right: none;
}
.bootstrap{
	:deep(.add-tag-input){
		width:120px;
	}
	:deep(.add-tag-input:hover){
		width:160px;
	}
}
:deep(.p-accordioncontent-content){
	padding: 0;
}
</style>
