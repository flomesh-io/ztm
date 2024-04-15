
<script setup>
import { ref, computed, onMounted } from "vue";
import store from "@/store";
import { useToast } from "primevue/usetoast";
import PipyProxyService from '@/service/PipyProxyService';
const pipyProxyService = new PipyProxyService();
const toast = useToast();
const data = ref({
    key: '0',
    type: 'globe',
    label: 'Gateway',
    children: [
    ]
});
const newServer = (node) => {
	node.children.unshift({
		parent: node.key,
		key: `${node.key}_${node.children}`,
		type: 'server',
		listen: '',
		target: ''
	});
}
const removeServer = (node) => {
	const parent = data.value.children.find(c => c.key == node.parent);
	const idx = parent.children.findIndex(c => c.key == node.key);
	parent.children.splice(idx,1);
}
const height = computed(() => {
	let total = 0;
	data.value.children.forEach(c => {
		total += c.children.length;
	});
	return `${total * 120 +400}px`
});
const mt = computed(() => {
	let total = 0;
	data.value.children.forEach(c => {
		total += c.children.length;
	});
	if(total == 0 ){
		return '0px';
	} else if(total == 1){
		return '-180px';
	} else {
		return `${total/2 * 120-400}px`
	}
	
});
const pb = computed(() => {
	let total = 0;
	data.value.children.forEach(c => {
		total += c.children.length;
	});
	return `200px`
});
const clients = ref([]);

onMounted(() => {
	store.commit('account/setClient', null);
	loadClients();
});
const loadClients = () => {
	data.value = {
		key: '0',
		type: 'globe',
		label: 'Gateway',
		children: []
	}
	pipyProxyService.clients()
		.then(res => {
			(res?.data||[]).forEach((item,index)=>{
				data.value.children.push({
					key: `0_${index}`,
					type: 'desktop',
					label: item,
					children: []
				})
			})
			loadBackend();
		})
		.catch(err => console.log('Request Failed', err)); 
}
const loadBackend = () => {
	pipyProxyService.getBackend()
		.then(res => {
			Object.keys(res?.data).forEach((_key)=>{
				const _services = res.data[_key]?.services;
				const _client = data.value.children.find(c=>c.label == _key);
				Object.keys(_services||{}).forEach((_backend)=>{
					_client.children.push({
						parent: _client.key,
						key: `${_client.key}_${_client.children.length}`,
						type: 'server',
						listen: _backend,
						target: _services[_backend]
					});
				})
			});
		})
		.catch(err => console.log('Request Failed', err)); 
}
const saveBackend = () => {
	const conf = {};
	data.value.children.forEach((c)=>{
		if(c.children.length>0){
			conf[c.label] = {services:{}};
			c.children.forEach(backend=>{
				if(!!backend.listen && !!backend.target){
					conf[c.label].services[backend.listen] = backend.target;
				}
			})
		}
	})
	pipyProxyService.saveBackend(conf)
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
</script>
<template>
	<div :style="{height: height, overflow: 'hidden'}">
	<OrganizationChart :style="{marginTop: mt}"  class="vertical-organization" :value="data" collapsible>
		 <template #server="slotProps">
					<div class="vertical-node" style="padding-left:10px;">
						<div class="item">
							<InputGroup>
								<InputGroupAddon>LISTEN</InputGroupAddon>
								<InputText size="small" type="text" v-model="slotProps.node.listen" placeholder="255.255.255.255:PORT" />
							</InputGroup>
						</div>
						<div class="item">
							<InputGroup>
								<InputGroupAddon>TARGET</InputGroupAddon>
								<InputText size="small" type="text" v-model="slotProps.node.target" placeholder="255.255.255.255:PORT" />
							</InputGroup>
						</div>
					</div>
				 <Button severity="secondary" class="mini-btn close" @click="removeServer(slotProps.node)" icon="pi pi-times" rounded />
		 </template>
		 <template #desktop="slotProps">
					<div class="flex align-items-center vertical-node">
						<div class="mr-2" style="padding-left:35px;">
							 <Avatar :icon="`pi pi-${slotProps.node.type}`" class="right-icon " />
						</div>
						<div class="font-medium text" style="width: 180px;word-wrap:break-word">{{ slotProps.node.label }}</div>
					</div>
					<div class="actions">
						<Button class="mini-btn mb-2"  v-if="slotProps.node.children.length>0" rounded :label="slotProps.node.children.length"/>
						<Button class="mini-btn"  @click="newServer(slotProps.node)" icon="pi pi-plus" rounded />
					</div>
		 </template>
		 <template #globe="slotProps">
					<div class="flex align-items-center vertical-node">
						<div class="mr-2" style="padding-left:40px;">
							 <Avatar :icon="`pi pi-${slotProps.node.type}`" class="right-icon " />
						</div>
						<div class="font-medium text-lg">{{ slotProps.node.label }}</div>
					</div>
					<div class="actions">
						<Button class="mini-btn" v-if="slotProps.node.children.length>0" rounded :label="slotProps.node.children.length"/>
					</div>
		 </template>
		 <template #default="slotProps">
				 <span>{{slotProps.node.data.label}}</span>
		 </template>
	</OrganizationChart>
	</div>
	<Button @click="saveBackend" :disabled="data.children.length==0" icon="pi pi-check" rounded aria-label="Filter" style="position: fixed;right: 30px;bottom:120px"/>
</template>
