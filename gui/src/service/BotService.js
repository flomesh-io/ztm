import { mock, request, getBaseUrl, getUrl,merge,fetchAsStream } from './common/request';
import toast from "@/utils/toast";
import confirm from "@/utils/confirm";
import { getItem, setItem, unshiftItem, STORE_SETTING_LLM, STORE_BOT_CONTENT, STORE_BOT_REPLAY } from "@/utils/localStore";
import _, { forEach } from 'lodash';
import store from "@/store";
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { writeLogFile } from '@/utils/file';
import MCPService from '@/service/MCPService';

export default class BotService {
	
	mcpService = null
	
	constructor(){
		this.mcpService = new MCPService();
	}
	
	getMesh(){
		return store.getters['account/selectedMesh'];
	}
	getSvcUrl(url, full){
		const mesh = this.getMesh();
		if(!mesh?.name){
			return '';
		}
		return getUrl(`/api/meshes/${mesh?.name}/apps/ztm/llm${url}`, full);
	}
	getFullSvcUrl(url){
		return this.getSvcUrl(url, true);
	}
	llmRequest(url, method, body, config){
		return request(this.getSvcUrl(url), method, body, config);
	}
	/*
	
		this.getServices().then((llmRes)=>{
			const llms = (llmRes.services||[]).filter((n)=>n.kind == 'llm');
			
		})
	*/
	getServices() {
		return this.llmRequest(`/api/services`, 'GET');
	}
	createRoute({ep, path, service, cors}) {
		return this.llmRequest(`/api/endpoints/${ep}/routes/${path}`,"POST", { service, cors });
	}
	deleteRoute({ep, path}) {
		return this.llmRequest(`/api/endpoints/${ep}/routes/${path.charAt(0)=='/'?path.substr(1):path}`,"DELETE",);
	}
	checkLLM(roomId, callback) {
		const mesh = this.getMesh();
		getItem(STORE_SETTING_LLM(mesh?.name, roomId), (res)=>{
			const llm = res && res[0] ? res[0] : null;
			if(!llm){
				this.getServices().then((llmRes)=>{
					const llms = llmRes?.services || [];
					if(llms && llms[0]){
						setItem(STORE_SETTING_LLM(mesh?.name, roomId), [llms[0]], (res)=>{});
						this.createRoute({
							ep: mesh?.agent?.id,
							path: `${llms[0].kind}/${llms[0].name}`,
							service: llms[0]
						}).then(()=>{
							callback(llms[0]);
						})
					}
				})
			} else {
				callback(llm);
			}
		});
	}
	makePrompt(role, content){
		switch (role){
			case 'user':
				return `请完成以下请求（如判定为tool_calls请求，**必须立即返回tool_calls**并遵守system_prompt。如果判断为非tool_calls请求，请用自然语言回答。）
请求：${content}`;
			case 'system':
				return `你是一个工具调用助手，必须严格遵循以下规则：
1. 判定为tool_calls请求时，你的**finish_reason**必须是**tool_calls**，不能是**stop**
2. 任务需要多条tool_calls完成时，一次性返回多条tool_calls
3. 自然语言（content字段）中禁止包含tool_calls结构，相关结构只应出现在**tool_calls字段**中。
4. 当工具调用返回结果，只能自然语言总结回复**描述性列表**
`;
			case 'tool':
				let _content = content?.text;
				if(content?.type!='text') {
					_content = JSON.stringify(content)
				}
				return `以下是工具调用结果，请整理为**描述性列表**再回复，禁止回复**tool▁calls▁begin**：${_content}`;
			default:
				return text;
		}
	}
	makeLLMToolsFormat(tools){
		const llmTools = [];
		tools.forEach((t)=>{
			if(!!t.type){
				llmTools.push(t)
			} else if(t.inputSchema) {
				llmTools.push({
				 "type": "function",
				 "function": {
					 "description": t.description,
					 "name": t.name,
					 "parameters": t.inputSchema,
					 "strict": false
				 }
				});
			} else if(t.name) {
				llmTools.push({
				 "type": "function",
				 "function": {
					 "name": t.name,
					 "parameters": t?.parameters,
				 }
				});
			}
		});
		return llmTools;
	}
	sliceContentToolcalls(content){
		let ary = content.split("```json");
		if(ary.length>=2 && !!ary[1]){
			let _json_str = ary[1].split("```")[0];
			try{
				let _json = JSON.parse(_json_str);
				return _json?.tool_calls || false;
			}catch(e){
				return false;
			}
		} else {
			return false;
		}
	}
	//{"model":"Qwen/QwQ-32B","messages":[{"role":"user","content":"What opportunities and challenges will the Chinese large model industry face in 2025?"}],"stream":false,"max_tokens":512,"enable_thinking":false,"thinking_budget":512,"min_p":0.05,"stop":null,"temperature":0.7,"top_p":0.7,"top_k":50,"frequency_penalty":0.5,"n":1,"response_format":{"type":"text"},"tools":[{"type":"function","function":{"description":"<string>","name":"<string>","parameters":{},"strict":false}}]}
	async callRunnerBySDK({roomId, historyContext, message, mcptools, llm, mcps, callback}) {
		const mesh = this.getMesh();
		let tools = mcptools || [];
		const usermessages = [{
				"role":"user",
				"content":this.makePrompt("user",message?.text)
		}]
		const allmessages = mcptools ? historyContext : (historyContext || []).concat(usermessages);
		if(!!mcps && mcps.length>0){
			const sysmessages = [];
			// get tools param
			const allClients = store.getters['mcp/clients'];
			if(tools.length==0){
				allClients.forEach((client,idx)=>{
					let _tools = JSON.parse(JSON.stringify(client.listTools?.tools||[]));
					_tools.forEach((tool)=>{
						tool.name = this.mcpService.uniqueName(tool.name, mcps[idx]?.name);
					})
					tools = tools.concat(_tools);
				});
			}
			sysmessages.push({"role": "system", "content": this.makePrompt("system")})
			
			let tool_calls = [];
			let merge_tool_calls = [];
			let delta = "";
			// get tool_calls with llm
			const resp = await this.chatLLM(roomId, sysmessages, allmessages, tools, llm, (res,ending)=> {
				const finish_reason = res.choices[0]?.finish_reason;
				const msg = res.choices[0]?.delta || res.choices[0]?.message;
				delta += msg?.content || msg?.reasoning_content || '';
				
				if(ending) {
					if(merge_tool_calls.length>0){
						const execute = (calls) => {
							// push tool msg
							store.commit('mcp/setToolcall', {
								status: 'progress',
								tool_calls: calls
							});
							callback(res, false);
							if(calls.length>0){
								allmessages.push({
									'content': '', 
									'refusal': null, 'annotations': null, 'audio': null, 'function_call': null, 
									'role': 'assistant', 
									tool_calls: calls
								});
							}
							
							this.replayToolcalls(calls).then((allToolsResult)=>{
								writeLogFile('ztm-llm.log', `[${new Date().toISOString()}] tool called: ${JSON.stringify(allToolsResult)}\n`);
								// push result msg
								allToolsResult.forEach((res)=>{
									const toolResult = res?.data;
									if(toolResult){
										if(toolResult?.result?.content){
											toolResult?.result?.content.forEach((toolResultContent)=>{
												allmessages.push({"role": "tool", "content": this.makePrompt('tool',toolResultContent), "tool_call_id": res.tool_call?.id})
											})
										}
										if(toolResult?.content){
											toolResult?.content.forEach((toolResultContent)=>{
												allmessages.push({"role": "tool", "content": this.makePrompt('tool',toolResultContent), "tool_call_id": res.tool_call?.id})
											})
										}
									}
								});
								
								unshiftItem(STORE_BOT_REPLAY(mesh?.name, roomId),{
									message: message?.text,
									toolcalls: allToolsResult,
									date: new Date().getTime(),
								},(res)=>{}, 10);
								
								this.callRunnerBySDK({roomId, historyContext:allmessages, message, mcptools: tools, llm, mcps, callback})
								// this.chatLLM(roomId, sysmessages, allmessages, tools, llm, callback);
							});
						}
						if(!!llm?.immediate){
							execute(merge_tool_calls);
						} else {
							const toolcall = {
								status: llm?.immediate?'immediate':'before',
								tool_calls: merge_tool_calls,
								cancel: ()=>{
									store.commit('mcp/setToolcall', {
										status: 'cancel',
									});
								},
								execute
							}
							store.commit('mcp/setToolcall', toolcall);
							callback(res, ending);
						}
						
					} else {
						
						callback(res, ending);
					}
				} else if(!!msg?.tool_calls && msg?.tool_calls?.length>0){
					// push assistant msg
					tool_calls = tool_calls.concat(msg?.tool_calls)
				} else if(finish_reason == "stop" && !tool_calls?.length && this.sliceContentToolcalls(delta)){
					merge_tool_calls = this.makeLLMToolsFormat(this.sliceContentToolcalls(delta))
				} else if(finish_reason == "tool_calls" || (finish_reason == "stop" && tool_calls.length>0)){
					
					let _arguments = "";
					//concat tool_calls arguments
					tool_calls.forEach((tool_call)=>{
						if(!!tool_call?.function?.name){
							if(merge_tool_calls.length>0){
								if(merge_tool_calls[merge_tool_calls.length-1].function){
									merge_tool_calls[merge_tool_calls.length-1].function.arguments = _arguments;
								}
								_arguments = "";
							}
							merge_tool_calls.push({...tool_call});
						}
						if(!!tool_call?.function?.arguments){
							_arguments += tool_call.function.arguments;
						}
					})
					if(merge_tool_calls.length>0){
						if(merge_tool_calls[merge_tool_calls.length-1].function){
							merge_tool_calls[merge_tool_calls.length-1].function.arguments = _arguments;
						}
						_arguments = "";
					}
					tool_calls = [];
					// push tool call req
					// todo
					
				} else if(!!msg?.content || !!msg?.reasoning_content) {
					callback(res, ending);
				} 
			});
		} else {
			this.chatLLM(roomId, [], allmessages,null, llm, callback);
		}
	}
	replayToolcalls(replay_tool_calls) {
		const toolReqs = [];
		replay_tool_calls.forEach((t)=>{
			toolReqs.push(this.callMcpToolBySDK(t?.tool_call || t).then((res)=> {
				return { data:res, tool_call:t.tool_call||t }
			}).catch((e)=>{}));
		})
		return merge(toolReqs);
	}
	callMcpToolBySDK(tool_call) {
		const uniqueToolName = tool_call[tool_call?.type]?.name;
		const args = !!tool_call[tool_call?.type]?.arguments?JSON.parse(tool_call[tool_call?.type].arguments):{};
		return this.mcpService.callTool(uniqueToolName, args);
	}
/**
"tools": [
		 {
			 "type": "function",
			 "function": {
				 "description": "<string>",
				 "name": "<string>",
				 "parameters": {},
				 "strict": false
			 }
		 }
	 ]
*/
	chatLLM(roomId, sysmessages, messages, tools, llm, callback) {
		const mesh = this.getMesh();
		let body = { messages: (sysmessages||[]).concat(messages)  };
		if(tools && tools.length>0){
			body.tools = this.makeLLMToolsFormat(tools);
		}
		let url = this.getSvcUrl(`/svc/${llm.kind}/${llm.name}/chat/completions`);
		writeLogFile('ztm-llm.log', `[${new Date().toISOString()}] request llm ${url} by ${JSON.stringify(body)}\n`);
		
		setItem(STORE_BOT_CONTENT(mesh?.name, roomId), messages, ()=> {
			const stream = fetchAsStream();
			stream.post(
				url, 
				body,
				callback
			)
		},llm?.memoryLength||10)
	}
}
