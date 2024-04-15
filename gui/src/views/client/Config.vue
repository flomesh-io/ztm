<script setup>
import { ref, onMounted, computed } from 'vue';
import PipyProxyService from '@/service/PipyProxyService';
import { useRoute } from 'vue-router'
import { useToast } from "primevue/usetoast";
import { isAdmin } from "@/service/common/authority-utils";
import store from "@/store";

const route = useRoute();
const toast = useToast();
const pipyProxyService = new PipyProxyService();

const ca = ref({
	organization:'',
	commonName: ''
});
const server = ref({
	name:'',
	port:9090,
	allow:false
})
const downloadHref = computed(()=>{
	return pipyProxyService.downloadCa({
		id: route.params?.id
	});
})
const loading = ref(true);
const config = ref({
    "configs": {
        "saveHeadAndBody": true,
        "username": "flomesh",
        "password": "flomesh",
				"version": "ver",
    },
    "servers": {
        "0.0.0.0:9090": {
            "name": ""
        }
    },
    "internal": {
        "reverseServer": {
            "target": "localhost:7070",
            "idleTimeout": "600s",
            "tlsCert": "internal/tls/client.crt",
            "tlsKey": "internal/tls/client.key",
            "tlsCA": "internal/tls/ca.crt",
            "viaHttpTunnel": true
        }
    }
});
const oldPassword = ref('');
const newPassword = ref('');
const tls = ref({
	default: true,
	tlsCertText: '',
	tlsKeyText: '',
	tlsCAText: '',
});
const tags = ref([]);
const search = () => {
	store.commit('account/setClient', route.params?.id);
	loading.value = true;
	pipyProxyService.getCa({
		id: route.params?.id
	})
		.then(res => {
			ca.value = res?.data;
		})
		.catch(err => console.log('Request Failed', err)); 
		
	pipyProxyService.getConfig({
		id: route.params?.id
	})
		.then(res => {
			config.value = res?.data;
			loading.value = false;
			if(config.value.internal && config.value.internal.reverseServer){
				if(!!config.value.internal.reverseServer.tlsCertText 
				&& !!config.value.internal.reverseServer.tlsKeyText
				&& !!config.value.internal.reverseServer.tlsCAText){
					tls.value.default = false;
				}
				tls.value.tlsCertText = config.value.internal.reverseServer?.tlsCertText || '';
				tls.value.tlsKeyText = config.value.internal.reverseServer?.tlsKeyText || '';
				tls.value.tlsCAText = config.value.internal.reverseServer?.tlsCAText || '';
			}
			Object.keys(config.value.servers).forEach((host) => {
				const _keyMap = host.split(":");
				server.value = {
					allow: _keyMap[0] == '0.0.0.0',
					port: _keyMap[1] * 1,
					name: config.value.servers[host]?.name
				}
			})
			
		})
		.catch(err => console.log('Request Failed', err)); 
}

const commitCa = () => {
	pipyProxyService.renewCa({
		id: route.params?.id,
		organization: ca.value?.organization,
		commonName: ca.value?.commonName,
	})
		.then(res => {
			if(res.data?.status == 'OK'){
				toast.add({ severity: 'success', summary:'Tips', detail: 'Modified successfully.', life: 3000 });
			} else{
				toast.add({ severity: 'error', summary:'Tips', detail: 'Modified Failed.', life: 3000 });
			}
		})
		.catch(err => console.log('Request Failed', err)); 
}
const commitConfig = () => {
	config.value.servers = {};
	const _host = server.value.allow?'0.0.0.0':'127.0.0.1';
	config.value.servers[`${_host}:${server.value.port||9090}`] = {
		name: server.value.name
	};
	if(!tls.value.default){
		config.value.internal.reverseServer.tlsCertText = tls.value.tlsCertText;
		config.value.internal.reverseServer.tlsKeyText = tls.value.tlsKeyText;
		config.value.internal.reverseServer.tlsCAText = tls.value.tlsCAText;
	}
	if(!!newPassword.value){
		config.value.configs.password = newPassword.value
	}
	pipyProxyService.saveConfig({
		id: route.params?.id,
		config: config.value,
	})
		.then(res => {
			if(res.data?.status == 'OK' || res.statusText == 'OK'){
				toast.add({ severity: 'success', summary:'Tips', detail: 'Modified successfully.', life: 3000 });
			} else{
				console.log(res)
				toast.add({ severity: 'error', summary:'Tips', detail: 'Modified Failed.', life: 3000 });
			}
		})
		.catch(err => console.log('Request Failed', err)); 
}
onMounted(() => {
	search();
});
const home = ref({
    icon: 'pi pi-desktop'
});
const active = ref(0);
async function copyCode(event) {
	const _host = server.value.allow?'0.0.0.0':'127.0.0.1';
	const _base = `${_host}:${server.value.port||9090}`;
    await navigator.clipboard.writeText(`export https_proxy=http://${_base};export http_proxy=http://${_base};`);
    event.preventDefault();
}
</script>

<template>
	<div v-if="route.params?.id" style="padding-left: 0px;padding-top: 0;padding-right: 0;m">
		<Breadcrumb :home="home" :model="[{label:route.params?.id}]" />
	</div>
	<div class="pt-5 pl-5 pr-5">
		<BlockViewer :tag="config.configs.version" text="Json" header="Config" containerClass="surface-section px-4 py-7 md:px-4 lg:px-5" >
			
			<template #actions>
				<Button label="Save" v-if="active == 0" :disabled="ca.organization.length == 0 || ca.commonName.length == 0" aria-label="Submit" size="small" @click="commitCa"/>
				<Button label="Save" v-else aria-label="Submit" size="small" @click="commitConfig"/>
			</template>
			<div v-if="loading" class="p-4">
			    <div class="flex mb-3">
			        <Skeleton shape="circle" size="4rem" class="mr-2"></Skeleton>
			        <div>
			            <Skeleton width="10rem" class="mb-2"></Skeleton>
			            <Skeleton width="5rem" class="mb-2"></Skeleton>
			            <Skeleton height=".5rem"></Skeleton>
			        </div>
			    </div>
			    <Skeleton width="100%" height="150px"></Skeleton>
			    <div class="flex justify-content-between mt-3">
			        <Skeleton width="4rem" height="2rem"></Skeleton>
			        <Skeleton width="4rem" height="2rem"></Skeleton>
			    </div>
			</div>
			<TabView v-else v-model:activeIndex="active" class="tabview-vertical">
				<TabPanel>
					<template #header>
							<div class="flex align-items-center gap-2">
								<i class="pi pi-id-card"/>	CA
							</div>
					</template>
					
					<div class="surface-section ml-5">
						<div class="font-medium text-3xl text-900 mb-5">CA Certificate
						<a :href="downloadHref" target="_blank"><Button style="position: relative;top: 5px;" icon="pi pi-download" text /></a>
						</div>
						<!-- <div class="text-500 mb-5">xxx</div> -->
						<ul class="list-none p-0 m-0">
							<li class="flex align-items-center py-3 px-2  border-bottom-1 surface-border flex-wrap">
									<div class="text-500 w-6 md:w-2 font-medium">Organization</div>
									<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
										<Chip class="pl-0 pr-3 mr-2">
										    <span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<i class="pi pi-sitemap"/>
												</span>
										    <span class="ml-2 font-medium">
													<InputText placeholder="Unset" class="add-tag-input xl" :unstyled="true" v-model="ca.organization" type="text" />
												</span>
										</Chip>
									</div>
							</li>
							<li class="flex align-items-center py-3 px-2  surface-border flex-wrap">
									<div class="text-500 w-6 md:w-2 font-medium">Common Name</div>
									<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
										<Chip class="pl-0 pr-3 mr-2">
										    <span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<i class="pi pi-bookmark"/>
												</span>
										    <span class="ml-2 font-medium">
													<InputText placeholder="Unset" class="add-tag-input xxl" :unstyled="true" v-model="ca.commonName" type="text" />
												</span>
										</Chip>
										
									</div>
							</li>
						</ul>
					</div>
				</TabPanel>
				<TabPanel>
					<template #header>
							<div class="flex align-items-center gap-2">
								<i class="pi pi-server" />	Server
							</div>
					</template>
					
					<div class="surface-section ml-5">
						<div class="font-medium text-3xl text-900 mb-5">Server</div>
						<!-- <div class="text-500 mb-5">xxx</div> -->
						<ul class="list-none p-0 m-0">
							<li class="flex align-items-center py-3 px-2  border-bottom-1 surface-border flex-wrap">
									<div class="text-500 w-6 md:w-2 font-medium">Server Name</div>
									<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
										<Chip class="pl-0 pr-3 mr-2">
										    <span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<i class="pi pi-server"/>
												</span>
										    <span class="ml-2 font-medium">
													<InputText placeholder="Unset" class="add-tag-input xl" :unstyled="true" v-model="server.name" type="text" />
												</span>
										</Chip>
									</div>
							</li>
							<li class="flex align-items-center py-3 px-2  border-bottom-1 surface-border flex-wrap">
									<div class="text-500 w-6 md:w-2 font-medium">Port</div>
									<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
										<Chip class="pl-0 pr-3 mr-2">
										    <span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<i class="pi pi-sort"/>
												</span>
										    <span class="ml-2 font-medium">
													<InputNumber :useGrouping="false" :min="0" :max="65535" placeholder="0-65535" class="add-tag-input" :unstyled="true" v-model="server.port" type="text" />
												</span>
										</Chip>
									</div>
							</li>
							<li class="flex align-items-center py-3 px-2 border-bottom-1 surface-border flex-wrap">
									<div class="text-500 w-6 md:w-2 font-medium">Allow connect from Lan</div>
									<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
										<Chip class="pl-0 pr-3 mr-2">
										    <span class=" w-3rem h-2rem flex align-items-center justify-content-center">
										    	<InputSwitch class="relative" style="left:2px"  v-model="server.allow" />
										    </span>
										    <span class="ml-2 font-medium pl-1 pr-2" v-if="server.allow">
													0.0.0.0
												</span>
										    <span class="ml-2 font-medium pl-1 pr-2" v-else>
													127.0.0.1
												</span>
										</Chip>
									</div>
							</li>
							<li class="flex align-items-center py-3 px-2 border-bottom-1 surface-border flex-wrap">
									<div class="text-500 w-6 md:w-2 font-medium">Save Head And Body</div>
									<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
										<InputSwitch class="relative" style="left:2px" v-model="config.configs.saveHeadAndBody" />
									</div>
							</li>
							<li class="flex align-items-center py-3 px-2  surface-border flex-wrap">
									<div class="text-500 w-6 md:w-2 font-medium">Copy Shell Export Command</div>
									<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
										<Button class="min-btn" rounded icon="pi pi-copy" @click="copyCode($event)" v-tooltip.focus.bottom="{ value: 'Copied to clipboard' }"/>
									</div>
							</li>
						</ul>
					</div>
				</TabPanel>
				<TabPanel>
					<template #header>
							<div class="flex align-items-center gap-2">
								<i class="pi pi-sliders-v" />	Tunnel
							</div>
					</template>
					
					<div class="surface-section ml-5">
						<div class="font-medium text-3xl text-900 mb-5">Tunnel</div>
						<!-- <div class="text-500 mb-5">xxx</div> -->
						<ul class="list-none p-0 m-0">
							<li class="flex align-items-center py-3 px-2  border-bottom-1 surface-border flex-wrap">
									<div class="text-500 w-6 md:w-2 font-medium">Target</div>
									<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
										<Chip class="pl-0 pr-3 mr-2">
										    <span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<i class="pi pi-box"/>
												</span>
										    <span class="ml-2 font-medium">
													<InputText placeholder="Unset" class="add-tag-input xl" :unstyled="true" v-model="config.internal.reverseServer.target" type="text" />
												</span>
										</Chip>
									</div>
							</li>
							
							<li class="flex align-items-center py-3 px-2 border-bottom-1 surface-border flex-wrap">
									<div class="text-500 w-6 md:w-2 font-medium">Via Http Tunnel</div>
									<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
										<InputSwitch class="relative" style="left:2px"  v-model="config.internal.reverseServer.viaHttpTunnel" />
									</div>
							</li>
							<li class="flex align-items-center py-3 px-2 border-bottom-1 surface-border flex-wrap">
									<div class="text-500 w-6 md:w-2 font-medium">Idle Timeout</div>
									<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
										<Chip class="pl-0 pr-3 mr-2">
										    <span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<i class="pi pi-clock"/>
												</span>
										    <span class="ml-2 font-medium">
													<InputText placeholder="Unset" class="add-tag-input" :unstyled="true" v-model="config.internal.reverseServer.idleTimeout" type="text" />
												</span>
										</Chip>
										
									</div>
							</li>
							
							<li class="flex align-items-center py-3 px-2 surface-border flex-wrap">
									<div class="text-500 w-6 md:w-2 font-medium">
										<span class="pr-2" v-if="tls.default">
											Default TLS
										</span>
										<span class="pr-2" v-else>
											Custom TLS
										</span>
										<InputSwitch class="relative" style="left:2px;vertical-align: middle;"  v-model="tls.default" />
										
									</div>
									<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
										
										<div v-if="tls.default">
											<Chip class="pl-0 pr-3 mr-2">
													<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
														Crt
													</span>
													<span class="ml-2 font-medium">
														<InputText :disabled="true" placeholder="Unset" class="add-tag-input xxl" :unstyled="true" v-model="config.internal.reverseServer.tlsCert" type="text" />
													</span>
											</Chip>
											<Chip class="pl-0 pr-3 mr-2">
													<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
														Key
													</span>
													<span class="ml-2 font-medium">
														<InputText :disabled="true" placeholder="Unset" class="add-tag-input xxl" :unstyled="true" v-model="config.internal.reverseServer.tlsKey" type="text" />
													</span>
											</Chip>
											<Chip class="pl-0 pr-3 mr-2">
													<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
														CA
													</span>
													<span class="ml-2 font-medium">
														<InputText :disabled="true" placeholder="Unset" class="add-tag-input xxl" :unstyled="true" v-model="config.internal.reverseServer.tlsCA" type="text" />
													</span>
											</Chip>
										
										</div>
										<div v-else>
												<div>
													<Chip class="pl-0 pr-3 mb-2 align-items-top"  >
															<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
																Crt
															</span>
															<span class="ml-2 font-medium">
																<Textarea  placeholder="Unset" class="add-tag-input max" :unstyled="true" v-model="tls.tlsCertText" :autoResize="false" rows="5" />
															</span>
													</Chip>
												</div>
												<div>
													<Chip class="pl-0 pr-3 mb-2 align-items-top">
															<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
																Key
															</span>
															<span class="ml-2 font-medium">
																<Textarea placeholder="Unset" class="add-tag-input max" :unstyled="true" v-model="tls.tlsKeyText" :autoResize="false" rows="5"  />
															</span>
													</Chip>
												</div>
												<div>
													<Chip class="pl-0 pr-3 mb-2 align-items-top">
															<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
																CA
															</span>
															<span class="ml-2 font-medium">
																<Textarea placeholder="Unset" class="add-tag-input max" :unstyled="true" v-model="tls.tlsCAText" :autoResize="false" rows="5" />
															</span>
													</Chip>
												</div>
										</div>
									</div>
							</li>
						</ul>
					</div>
				</TabPanel>
				<TabPanel>
					<template #header>
							<div class="flex align-items-center gap-2">
								<i class="pi pi-user" />	Auth
							</div>
					</template>
					
					<div class="surface-section ml-5">
						<div class="font-medium text-3xl text-900 mb-5">Auth</div>
						<!-- <div class="text-500 mb-5">xxx</div> -->
						<ul class="list-none p-0 m-0">
							<li class="flex align-items-center py-3 px-2  border-bottom-1 surface-border flex-wrap">
									<div class="text-500 w-6 md:w-2 font-medium">User</div>
									<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
										<Chip class="pl-0 pr-3 mr-2">
										    <span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<i class="pi pi-user"/>
												</span>
										    <span class="ml-2 font-medium">
													<InputText placeholder="Unset" class="add-tag-input xl" :unstyled="true" v-model="config.configs.username" type="text" />
												</span>
										</Chip>
									</div>
							</li>
							<li class="flex align-items-center py-3 px-2 border-bottom-1 surface-border flex-wrap">
									<div class="text-500 w-6 md:w-2 font-medium">Password</div>
									<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
										<Chip class="pl-0 pr-3 mr-2">
										    <span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<i class="pi pi-key"/>
												</span>
										    <span class="ml-2 font-medium">
													<Password placeholder="Old Password" class="add-tag-input xxl" :unstyled="true" v-model="oldPassword" type="text" />
												</span>
										</Chip>
										
									</div>
							</li>
							<li class="flex align-items-center py-3 px-2  surface-border flex-wrap">
									<div class="text-500 w-6 md:w-2 font-medium">New Password</div>
									<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
										<Chip :class="oldPassword != config.configs.password?'disabled':''" class="pl-0 pr-3 mr-2">
										    <span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<i class="pi pi-key"/>
												</span>
										    <span class="ml-2 font-medium">
													<Password :disabled="oldPassword != config.configs.password" placeholder="Unset" class="add-tag-input xxl" :unstyled="true" v-model="newPassword" type="text" />
												</span>
										</Chip>
										
									</div>
							</li>
							
						</ul>
					</div>
				</TabPanel>
			</TabView>
		</BlockViewer>
	</div>
</template>


<style scoped lang="scss">
::v-deep(.p-breadcrumb){
	border-radius: 0;
	border-left: none;
	border-right: none;
}
</style>
