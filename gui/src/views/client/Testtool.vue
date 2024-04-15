<script setup>
import { ref,onMounted, onBeforeUnmount } from 'vue';
import TerminalService from "primevue/terminalservice";
import PipyProxyService from '@/service/PipyProxyService';
const pipyProxyService = new PipyProxyService();
import { useRoute } from 'vue-router'
import store from "@/store";
import { mkConfig, generateCsv, download } from "export-to-csv";
import freeSvg from "@/assets/img/free.svg";
const route = useRoute();

const cmdType = ref('download');
const msg = {
	download: 'Type the download address please...',
	ping: 'Type the ping IP address please...',
	scan: 'Type the scan IP address please...',
	'os': 'Type the OS query please...',
	'db': 'Type the sqllite query please...',
}

const info = ref({
  "hostname": "DESKTOP-5SI23LH",
  "osName": "Microsoft Windows 10",
  "osVersion": "10.0.19045  Build 19045",
  "lastBootUptime": "2023/12/26, 10:27:09",
  "cpuInfo": "Intel64 Family 6 Model 154 Stepping 3 GenuineIntel ~2496 Mhz",
  "ipAddress": "192.168.122.242",
  "mac": "52-54-00-B8-84-04"
});
const systemProxy = ref(true);

const typing = ref('');
const port = ref({
	start:1,
	end:65535
})
const home = ref({
    icon: 'pi pi-desktop'
});
const loading = ref(false);
const history = ref({
	ping:[],
	download:[],
	scan:[],
	os:[{
		value:"SELECT * FROM routes WHERE destination = '::1'"
	}],
	db:[{
		value: `Select 
		 client_ip,
		 host,
		 id,
		 request_size,
		 request_time,
		 response_code,
		 response_size,
		 response_time,
		 scheme,
		 url,
		 user_agent
		 From pipy  where  request_time > '2024-01-20 15:17:30' and  request_time < '2024-01-22 15:17:30' order by request_time desc Limit 20 Offset 0`
	}]
});

onMounted(() => {
    TerminalService.on('command', commandHandler);
		store.commit('account/setClient', route.params?.id);
		pipyProxyService.info({
			id: route.params?.id
		})
			.then(res => {
				info.value = res?.data;
				systemProxy.value = res?.data?.systemProxy == 'on';
			})
			.catch(err => console.log('Request Failed', err)); 
		getHistory();
})

onBeforeUnmount(() => {
    TerminalService.off('command', commandHandler);
})
const changeProxy = () => {
	pipyProxyService.invoke({
		id: route.params?.id,
		verb: systemProxy.value?"enable-proxy":"disable-proxy", 
	})
	.then(res => {
	})
	.catch(err => {
	}); 
}
const result = ref()
const togHistory = (node) => {
	typing.value = node.value;
	if(!!node.port){
		port.value.start = node.port.start;
		port.value.end = node.port.end;
	}
	commandHandler(false);
}
const clickSearch = () => {
	if(!history.value[cmdType.value]){
		history.value[cmdType.value] = []
	}
	const _history = JSON.parse(JSON.stringify(history.value[cmdType.value]));
	if(cmdType.value == 'scan'){
		_history.unshift({
			value: typing.value,
			port: port.value
		});
	} else {
		_history.unshift({
			value: typing.value
		});
	}
	if(_history.length>10){
		_history.splice(9,1);
	}
	commandHandler(_history);
}
const fetchHistory = (_history) => {
	if(_history!=false){
		history.value[cmdType.value] = _history;
		localStorage.setItem('History',JSON.stringify(history.value))
	}
}
const getHistory = () => {
	const _history = localStorage.getItem('History');
	if(!!_history){
		try{
			history.value = JSON.parse(_history)
		}catch(e){
		}
	}
}
const csvConfig = mkConfig({ useKeysAsHeaders: true });
const exportCsv = () => {
	let exportData = [];
	if(Array.isArray(result.value)) {
		exportData = result.value;
	} else if (cmdType.value == 'scan'){
		Object.keys(result.value).forEach((_port)=>{
			exportData.push({
				PORT: _port,
				DATA: result.value[_port]
			})
		})
	}
	const csv = generateCsv(csvConfig)(exportData);
	download(csvConfig)(csv);
}
const commandHandler = (_history) => {
		loading.value = true;
    let response;
    let argsIndex = typing.value.indexOf(' ');
    let command = argsIndex !== -1 ? typing.value.substring(0, argsIndex) : typing.value;
		
		if(cmdType.value == 'os'){
			pipyProxyService.os({
				id: route.params?.id,
				sql: typing.value
			})
				.then(res => {
					result.value = res?.data;
					fetchHistory(_history);
					loading.value = false;
					// TerminalService.emit('response', JSON.stringify(res?.data,null,'\t'));
				})
				.catch(err => {
					result.value = err?.response?.data;
					loading.value = false;
					// TerminalService.emit('response', err?.response?.data?.error || err);
				}); 
			
		} else if(cmdType.value == 'db'){
			pipyProxyService.query({
				id: route.params?.id,
				sql: typing.value
			})
				.then(res => {
					result.value = res?.data;
					fetchHistory(_history);
					loading.value = false;
					// TerminalService.emit('response', JSON.stringify(res?.data,null,'\t'));
				})
				.catch(err => {
					result.value = err?.response?.data;
					loading.value = false;
					// TerminalService.emit('response', err?.response?.data?.error || err);
				}); 
			
		} else if(cmdType.value == 'scan') {
			pipyProxyService.invoke({
				id: route.params?.id,
				config: {
					verb: cmdType.value,
					target: typing.value,
					portStart: port.value.start,
					portEnd: port.value.end
				}
			})
				.then(res => {
					let data = res?.data;
					// data = {
					// 	"8080":{"state":"ConnectionRefused"},
					// 	"9090":{"state":"OK",data: "hello"},
					// }
					result.value = {};
					let total = {};
					if(!!data){
						Object.keys(data).forEach((_port) => {
							if(data[_port].state=="OK"){
								result.value[_port] = data[_port];
							}else if(!result.value[data[_port].state]){
								total[data[_port].state] = 1;
								result.value[data[_port].state] = `${total[data[_port].state]} Ports` ;
							}else {
								total[data[_port].state]++;
								result.value[data[_port].state] = `${total[data[_port].state]} Ports` ;
							}
						})
					}
					fetchHistory(_history);
					loading.value = false;
					// TerminalService.emit('response', JSON.stringify(res?.data,null,'\t'));
				})
				.catch(err => {
					result.value = err?.response?.data;
					loading.value = false;
					// TerminalService.emit('response', err?.response?.data?.error || err);
				}); 
			
		} else {
			pipyProxyService.invoke({
				id: route.params?.id,
				config: {
					verb: cmdType.value,
					target: typing.value
				}
			})
				.then(res => {
					result.value = res?.data;
					fetchHistory(_history);
					loading.value = false;
					// TerminalService.emit('response', JSON.stringify(res?.data,null,'\t'));
				})
				.catch(err => {
					result.value = err?.response?.data;
					loading.value = false;
					// TerminalService.emit('response', err?.response?.data?.error || err);
				}); 
			
		}
    
}
const watchEnter = (e) => {
	if(e.code == 'Enter' && e.ctrlKey){
		clickSearch();
	}
}
</script>

<template>

		<div v-if="route.params?.id" style="padding-left: 0px;padding-top: 0;padding-right: 0;">
			<Breadcrumb :home="home" :model="[{label:route.params?.id}]" />
		</div>
		<Card class="nopd ml-3 mr-3 mt-3">
			
		<template #content>
			
			<InputGroup>
				<Button :label="cmdType" />
				<Textarea @keyup="watchEnter" v-model="typing" :autoResize="true" class="drak-input bg-gray-900 text-white" :placeholder="msg[cmdType]" rows="1" cols="30" />
				
				<Button v-if="cmdType=='scan'" label="Port" />
				<InputNumber :useGrouping="false" v-if="cmdType=='scan'" :min="1" :max="65535" placeholder="Start" class=" drak-input bg-gray-900 text-white" style="width:80px;flex:none;" v-model="port.start" />
				<Button v-if="cmdType=='scan'" label=" ~ " />
				<InputNumber :useGrouping="false" v-if="cmdType=='scan'" :min="1" :max="65535" placeholder="End" class=" drak-input bg-gray-900 text-white" style="width:80px;flex:none;" v-model="port.end" />
				<Button :disabled="!typing" icon="pi pi-arrow-down-left"  @click="clickSearch"/>
			</InputGroup>
			<!-- <Terminal
					:welcomeMessage="msg[cmdType]"
					:prompt="cmdType+' $'"
					aria-label="Test Tool"
					:pt="{
							root: 'bg-gray-900 text-white border-round',
							prompt: 'text-gray-400 mr-2',
							command: 'text-primary-300',
							response: 'text-green-300'
					}"
			/> 
			
			
			Select 
					 client_ip,
					 host,
					 id,
					 request_size,
					 request_time,
					 response_code,
					 response_size,
					 response_time,
					 scheme,
					 url,
					 user_agent
					 From pipy  where  request_time > '2024-01-20 11:45:03' and  request_time < '2024-01-22 11:45:03' order by request_time desc Limit 20 Offset 0
					 
					 
			-->
		</template>
	</Card>
	<div class="text-center mt-3">
		
		<Chip class="pl-0 pr-3">
				<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
					<RadioButton v-model="cmdType" inputId="cmdType1" name="cmdType" value="download" />
				</span>
				<span class="ml-2 font-medium">Download</span>
		</Chip>
		
		<Chip class="ml-2 pl-0 pr-3">
				<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
					<RadioButton v-model="cmdType" inputId="cmdType2" name="cmdType" value="ping" />
				</span>
				<span class="ml-2 font-medium">Ping</span>
		</Chip>
		
		<Chip class="ml-2 pl-0 pr-3">
				<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
					<RadioButton v-model="cmdType" inputId="cmdType3" name="cmdType" value="scan" />
				</span>
				<span class="ml-2 font-medium">Scan</span>
		</Chip>
		
		<Chip class="ml-2 pl-0 pr-3">
				<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
					<RadioButton v-model="cmdType" inputId="cmdType4" name="cmdType" value="os" />
				</span>
				<span class="ml-2 font-medium">OS Query</span>
		</Chip>
		
		<Chip class="ml-2 pl-0 pr-3">
				<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
					<RadioButton v-model="cmdType" inputId="cmdType5" name="cmdType" value="db" />
				</span>
				<span class="ml-2 font-medium">DB Query</span>
		</Chip>
		<Chip class="ml-2 pl-0 pr-3 relative" style="vertical-align: middle;top:-2px">
				<span class=" w-3rem h-2rem flex align-items-center justify-content-center">
					<InputSwitch class="relative" style="left:2px" @click="changeProxy"  v-model="systemProxy" />
				</span>
				<span class="ml-2 font-medium">System Proxy</span>
		</Chip>
	</div>
	
	<div class="grid mr-2 ml-2 mt-5 mb-5" >
		<div class="col-12 md:col-9">
			<button @click="exportCsv" class="layout-config-button p-link" type="button" v-if="!loading && !!result && (Array.isArray(result) || cmdType == 'scan')" style="margin-top:2rem;">
			    <i class="pi pi-download"></i>
			</button>
			<div v-if="loading">
				<Skeleton class="mb-2" width="10rem" height="4rem"></Skeleton>
				<Skeleton width="25rem" class="mb-2"></Skeleton>
				<Skeleton class="mb-2"></Skeleton>
				<Skeleton width="40rem" class="mb-2"></Skeleton>
				<Skeleton class="mb-2"></Skeleton>
				<Skeleton height="2rem" class="mb-2"></Skeleton>
			</div>
			
			<Card class="nopd" v-else-if="typeof(result) == 'string'">
				<template #content>
					<pre class="app-code"><code>{{result}}</code></pre>
				</template>
			</Card>
			<Card class="nopd" v-else-if="Array.isArray(result)">
				<template #content>
			      <DataTable
							showGridlines
							size="small"
							:value="result"
							:rowHover="true"
							resizableColumns
							filterDisplay="menu"
							:loading="loading"
							responsiveLayout="scroll"
			      >
			          <template #empty> No results. </template>
								<Column v-if="result.length>0" v-for="(k,i) in Object.keys(result[0])" :key="k" :showFilterOperator="false" :showFilterMatchModes="false"   :field="k" :header="k" >
										<template #body="{ data }">
											{{data[k]}}
										</template>
								</Column>
								<Column v-else field="result" header="Status">
									<template #body="{ data }" >
										result
									</template>
								</Column>
			      </DataTable>
				</template>
			</Card>
			<card class="nopd" v-else-if="!!result?.status">
				<template #content>
					<ul class="list-none p-0 m-0">
						<li :class="{'border-top-1':i>0,'hidden':k == 'result'}" v-for="(k,i) in Object.keys(result)" :key="k" class="flex align-items-center py-3 px-5 surface-border flex-wrap">
							<div class="text-500 w-6 md:w-2 font-medium">{{k}}</div>
							<div v-if="k != 'status'" class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">{{result[k]}}</div>
							<div v-else-if="k == 'status'" class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
								<Tag :severity="{OK:'success',ERROR:'danger',FAIL:'danger'}[result.status]" :value="result.status"></Tag>
							</div>
						</li>
						<li :class="{'hidden':k == 'status'}" v-if="result?.result" v-for="(k) in Object.keys(result.result)" :key="k" class="border-top-1 flex align-items-center py-3 px-5 surface-border flex-wrap">
							<div class="text-500 w-6 md:w-2 font-medium">{{k}}</div>
							<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">{{result?.result[k]}}</div>
						</li>
					</ul>
				</template>
			</card>
			<card class="nopd" v-else-if="!!result?.error">
				<template #content>
					<ul class="list-none p-0 m-0">
						<li class="flex align-items-center py-3 px-5 surface-border flex-wrap">
							<div class="text-500 w-6 md:w-2 font-medium">ERROR</div>
							<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
								<Tag severity="danger" :value="result.error"></Tag>
							</div>
						</li>
					</ul>
				</template>
			</card>
			<card class="nopd" v-else-if="typeof(result) == 'object'">
				<template #content>
					<ul class="list-none p-0 m-0">
						<li :class="{'border-top-1':i>0,'hidden':k == 'result'}" v-for="(k,i) in Object.keys(result)" :key="k" class="flex align-items-center py-3 px-5 surface-border flex-wrap">
							<div class="text-500 w-6 md:w-2 font-medium">{{k}}</div>
							<div v-if="k != 'status'" class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1 pl-2">{{result[k]}}</div>
							<div v-else-if="k == 'status'" class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
								<Tag :severity="{OK:'success',ERROR:'danger',FAIL:'danger'}[result.status]" :value="result.status"></Tag>
							</div>
						</li>
					</ul>
				</template>
			</card>
			<div v-else class="text-center">
				<img :src="freeSvg" class="w-5 h-5 mx-aut" style="margin: auto;" alt="free" />
			</div>
		</div>
		<div class="col-12 md:col-3">
			<card class="nopd">
				<template #content>
					<Listbox class="w-full" style="border:none" :options="history[cmdType]" optionLabel="value" optionValue="value"
						:virtualScrollerOptions="{ itemSize: 38 }" listStyle="height:350px" >
							<template #option="slotProps">
								<div @click="togHistory(slotProps.option)" class="flex w-full" style="line-height:38px">
									<div class="text-center"><b class="" >&nbsp;&nbsp;&nbsp;&nbsp;{{cmdType}}:&nbsp;&nbsp;</b></div>
									<div style="flex:1;overflow: hidden;">
										<div style="white-space: nowrap;text-overflow: ellipsis;width:95%;overflow: hidden;">
											{{ slotProps.option.value }}
											<span v-if="cmdType == 'scan' && slotProps.option.port">
												Port {{slotProps.option.port.start}} ~  {{slotProps.option.port.end}}
											</span>
										</div>
									</div>
									<b>&nbsp;&nbsp;<i class="pi pi-arrow-down-left"/>&nbsp;&nbsp;&nbsp;&nbsp;</b>
								</div>
							</template>
					</Listbox>
				</template>
			</card>
		</div>
	</div>
</template>

<style scoped lang="scss">
::v-deep(.p-breadcrumb){
	border-radius: 0;
	border: none;
}
.drak-input{
	border: none;
}
.hidden{
	display: none !important;
}
::v-deep(.p-listbox-list){
	padding-left: 0;
	padding-right: 0;
	width: 100%;
}
::v-deep(.p-listbox .p-listbox-list .p-listbox-item){
	padding: 0;
}
</style>
