import { mock, request, getUrl,merge } from './common/request';
import toast from "@/utils/toast";
import confirm from "@/utils/confirm";
import { getItem, setItem } from "@/utils/localStore";
import _, { forEach } from 'lodash';
import store from "@/store";
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

export default class ChatService {
	
	getMesh(){
		return store.getters['account/selectedMesh'];
	}
	llmRequest(url, method, body, config){
		const mesh = this.getMesh();
		if(!mesh?.name){
			return 
		}
		const options = {
			mesh:mesh?.name,
			ep:mesh?.agent?.id,
			provider:'ztm',
			app:'llm',
		}
		const base = getUrl(`/api/meshes/${options?.mesh}/apps/${options?.provider}/${options?.app}`);
		return request(`${base}${url}`, method, body, config);
	}
	/*
	
		this.getServices().then((llmRes)=>{
			const llms = (llmRes.services||[]).filter((n)=>n.kind == 'llm');
			
		})
	*/
	getServices() {
		return this.llmRequest(`/api/services`, 'GET');
	}
	createRoute({ep, path, service}) {
		return this.llmRequest(`/api/endpoints/${ep}/routes/${path}`,"POST", { service });
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
	callRunner({message, llm, mcps, callback}) {
		const usermessages = [
			{
				"role":"user",
				"content":message?.text
			}
		]
		if(!!mcps && mcps.length>0){
			// get tools param
			const mcpReqs = [];
			mcps.forEach((mcp) => {
				mcpReqs.push(this.getMCPParams(mcp))
			});
			merge(mcpReqs).then((allParams)=>{
				let allmessages = [];
				const sysmessages = [];
				allParams.forEach((params)=>{
					sysmessages.push({"role": "system", "content": JSON.stringify(params)})
				});
				allmessages = sysmessages.concat(usermessages);
				// get tool_calls with llm
				this.chatLLM(allmessages, llm).then((res)=> {
					if(res.choices[0]?.finish_reason == "tool_calls"){
						// push assistant msg
						const tool_calls = res.choices[0]?.message?.tool_calls;
						allmessages.push({
							'content': '', 
							'refusal': null, 'annotations': null, 'audio': null, 'function_call': null, 
							'role': 'assistant', 
							tool_calls
						});
						const toolReqs = [];
						tool_calls.forEach((tool_call,idx)=>{
							const argv = JSON.parse(tool_call.function.arguments);
							toolReqs.push(this.getMCPParams(mcps[idx],{"params":{"name":tool_call.function.name, "arguments":(argv||{})},"method":"tools/call"}));
						})
						merge(toolReqs).then((allToolsResult)=>{
							// push result msg
							allToolsResult.forEach((toolResult,idx)=>{
								toolResult?.result?.content.forEach((toolResultContent)=>{
									if(toolResultContent.type=='text'){
										allmessages.push({"role": "tool", "content": toolResultContent.text,"tool_call_id": tool_calls[idx].id})
									} else {
										allmessages.push({"role": "tool", "content": JSON.stringify(toolResultContent),"tool_call_id": tool_calls[idx].id})
									}
								})
							});
							this.chatLLM(allmessages, llm).then((result)=> callback(result));
						});
					} else {
						callback(res);
					} 
					console.log(res);
				});
			})
		} else {
			this.chatLLM(usermessages, llm).then((res)=> callback(res));
		}
	}
	getMCPParams(mcp, body) {
		return this.llmRequest(`/svc/${mcp.kind}/${mcp.name}`, "POST", {
      "jsonrpc": "2.0",
			"id": 1,
			...(body || {"method": "tools/list"})
    })
	}
	chatLLM(messages, llm) {
		const body = { messages };
		return this.llmRequest(`/svc/${llm.kind}/${llm.name}/chat/completions`, "POST", body)
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
