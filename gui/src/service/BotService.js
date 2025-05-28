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
	//{"model":"Qwen/QwQ-32B","messages":[{"role":"user","content":"What opportunities and challenges will the Chinese large model industry face in 2025?"}],"stream":false,"max_tokens":512,"enable_thinking":false,"thinking_budget":512,"min_p":0.05,"stop":null,"temperature":0.7,"top_p":0.7,"top_k":50,"frequency_penalty":0.5,"n":1,"response_format":{"type":"text"},"tools":[{"type":"function","function":{"description":"<string>","name":"<string>","parameters":{},"strict":false}}]}
	async callRunnerBySDK({message, llm, mcps, callback}) {
		const usermessages = [
			{
				"role":"user",
				"content":`请完成以下任务（**如判定为工具调用请求，必须返回工具调用，不可过多描述步骤，当存在工具执行结果一定要“完整”的返回, 当执行结果存在“路径”一定要返回。如果判断为非工具调用，请用自然语言回答。**）
任务：${message?.text}`
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
				sysmessages.push({"role": "system", "content": `你是一个任务执行助手，必须通过直接调用工具（MCP Tools）完成任务。
规则：
1. 当用户请求涉及工具能力时，**必须**返回 \`tool_calls\`, 不可过多描述调用过程。
2. 工具调用需符合以下格式：
\`\`\`json
${JSON.stringify(tools)}
\`\`\``})
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
											if(toolResultContent.type=='text'){
												allmessages.push({"role": "tool", "content": toolResultContent.text,"tool_call_id": res.tool_call?.id})
											} else {
												allmessages.push({"role": "tool", "content": JSON.stringify(toolResultContent),"tool_call_id": res.tool_call?.id})
											}
										})
									}
									if(toolResult?.content){
										toolResult?.content.forEach((toolResultContent)=>{
											if(toolResultContent.type=='text'){
												allmessages.push({"role": "tool", "content": toolResultContent.text,"tool_call_id": res.tool_call?.id})
											} else {
												allmessages.push({"role": "tool", "content": JSON.stringify(toolResultContent),"tool_call_id": res.tool_call?.id})
											}
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
	/*
	{
	    "id": "01968bc66c4a2c9f9bbf3a5e2cac7e7c",
	    "object": "chat.completion",
	    "created": 1746101759,
	    "model": "deepseek-ai/DeepSeek-R1",
	    "choices": [
	        {
	            "index": 0,
	            "message": {
	                "role": "assistant",
	                "content": "\n\n",
	                "reasoning_content": "Okay, let's see. The user wrote \"qwe\". That doesn't seem to make much sense. Maybe it's a typo or a random input. I need to figure out what they want. The available tool is called \"\u003cstring\u003e\", but the description and parameters are also \"\u003cstring\u003e\", which is confusing. Maybe the tool is meant to handle string inputs? Since the parameters are empty, perhaps it's a simple tool that just takes any string.\n\nWait, the parameters object is empty in the tool definition, so how should I use it? The strict mode is false, so maybe it can accept any parameters even if they aren't defined. But that's not standard. Maybe there's a mistake in the tool definition. Alternatively, maybe the tool expects a string parameter but it wasn't properly documented.\n\nSince the user input is \"qwe\", I'll assume they want to pass this string to the tool named \"\u003cstring\u003e\". Even though the parameters schema is empty, perhaps the tool can process it by taking the input as a parameter named \"input\" or something similar. But since I don't have clear documentation, I'll have to make an educated guess.\n\nI'll proceed by calling the \"\u003cstring\u003e\" tool with the user's input as a parameter. Let's structure the JSON accordingly, using \"input\" as the parameter name and \"qwe\" as its value.\n",
	                "tool_calls": [
	                    {
	                        "index": 0,
	                        "id": "01968bc6e1053e4b4576327e351d3787",
	                        "type": "function",
	                        "function": {
	                            "name": "\u003cstring\u003e",
	                            "arguments": {
	                                "input": "qwe"
	                            }
	                        }
	                    }
	                ]
	            },
	            "finish_reason": "tool_calls"
	        }
	    ],
	    "usage": {
	        "prompt_tokens": 143,
	        "completion_tokens": 287,
	        "total_tokens": 430,
	        "completion_tokens_details": {
	            "reasoning_tokens": 282
	        }
	    },
	    "system_fingerprint": ""
	}
	*/
}
