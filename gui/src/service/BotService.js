import { mock, request, getBaseUrl, getUrl,merge,fetchAsStream } from './common/request';
import toast from "@/utils/toast";
import confirm from "@/utils/confirm";
import { getItem, setItem } from "@/utils/localStore";
import _, { forEach } from 'lodash';
import store from "@/store";
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
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
		return this.llmRequest(`/api/endpoints/${ep}/routes/${path}`,"DELETE",);
	}
	checkLLM(callback) {
		const mesh = this.getMesh();
		getItem(`llm-${mesh?.name}`, (res)=>{
			const llm = res && res[0] ? res[0] : null;
			if(!llm){
				this.getServices().then((llmRes)=>{
					const llms = llmRes?.services || [];
					if(llms && llms[0]){
						setItem(`llm-${mesh?.name}`, [llms[0]], (res)=>{});
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
				return `请完成以下请求（**如判定为工具调用请求，必须返回工具调用并遵守system_prompt。如果判断为非工具调用，请用自然语言回答。**）
请求：${content}`;
			case 'system':
				return `你是一个工具调用助手，必须严格遵循以下规则：
1. 当用户请求需要tool时，**只能**返回合法的 \`tool_calls\`，自然语言只能回复**正在请求任务...\n\n**。
2. 当tool消息执行返回结果，只能回复**描述性列表**

这是listTools：
\`\`\`json
${JSON.stringify(content)}
\`\`\``;
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
	//{"model":"Qwen/QwQ-32B","messages":[{"role":"user","content":"What opportunities and challenges will the Chinese large model industry face in 2025?"}],"stream":false,"max_tokens":512,"enable_thinking":false,"thinking_budget":512,"min_p":0.05,"stop":null,"temperature":0.7,"top_p":0.7,"top_k":50,"frequency_penalty":0.5,"n":1,"response_format":{"type":"text"},"tools":[{"type":"function","function":{"description":"<string>","name":"<string>","parameters":{},"strict":false}}]}
	async callRunnerBySDK({message, llm, mcps, callback}) {
		const usermessages = [
			{
				"role":"user",
				"content":this.makePrompt("user",message?.text)
			}
		]
		if(!!mcps && mcps.length>0){
			// get tools param
			const allClients = store.getters['mcp/clients'];
			
			let allmessages = [];
			const sysmessages = [];
			allClients.forEach((client,idx)=>{
				let tools = JSON.parse(JSON.stringify(client.listTools?.tools||[]));
				tools.forEach((tool)=>{
					tool.name = this.mcpService.uniqueName(tool.name, mcps[idx]?.name);
				})
				sysmessages.push({"role": "system", "content": this.makePrompt("system",tools)})
			});
			allmessages = sysmessages.concat(usermessages);
			let tool_calls = [];
			let toolReqs = [];
			// get tool_calls with llm
			const resp = await this.chatLLM(allmessages, llm, (res,ending)=> {
				const finish_reason = res.choices[0]?.finish_reason;
				const msg = res.choices[0]?.delta || res.choices[0]?.message;
				
				if(ending) {
					if(toolReqs.length>0){
						merge(toolReqs).then((allToolsResult)=>{
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
							toolReqs = [];
							this.chatLLM(allmessages, llm, callback);
						});
					} else {
						callback(res, ending);
					}
				} else if(!!msg?.tool_calls && msg?.tool_calls?.length>0){
					// push assistant msg
					tool_calls = tool_calls.concat(msg?.tool_calls)
				} else if(finish_reason == "tool_calls" || (finish_reason == "stop" && tool_calls.length>0)){
					
					let _arguments = "";
					const merge_tool_calls = []
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
					// push tool msg
					if(merge_tool_calls.length>0){
						allmessages.push({
							'content': '', 
							'refusal': null, 'annotations': null, 'audio': null, 'function_call': null, 
							'role': 'assistant', 
							tool_calls: merge_tool_calls
						});
					}
					// push tool call req
					merge_tool_calls.forEach((tool_call)=>{
						const argv = !!tool_call?.function?.arguments?JSON.parse(tool_call.function.arguments):{};
						toolReqs.push(this.callMcpToolBySDK(tool_call?.function?.name, argv).then((res)=> {
							return { data:res, tool_call }
						}).catch((e)=>{}));
					})
				} else if(!!msg?.content || !!msg?.reasoning_content) {
					callback(res, ending);
				} 
			});
		} else {
			this.chatLLM(usermessages, llm, callback);
		}
	}
	callMcpToolBySDK(uniqueToolName, args) {
		return this.mcpService.callTool(uniqueToolName, args);
	}
	chatLLM(messages, llm, callback) {
		const body = { messages };
		const stream = fetchAsStream();
		stream.post(
			this.getSvcUrl(`/svc/${llm.kind}/${llm.name}/chat/completions`), 
			body,
			callback
		)
	}
}
