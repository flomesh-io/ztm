<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { merge } from '@/service/common/request';
import FileService from '../service/FileService';
import { useRoute } from 'vue-router'
import { useToast } from "primevue/usetoast";
import { useStore } from 'vuex';
import _ from "lodash"
const props = defineProps(['d','endpointMap']);
const emits = defineEmits(['save','back']);
const store = useStore();
const endpoints = ref([]);
const users = ref([]);
const route = useRoute();
const toast = useToast();
const fileService = new FileService();
const info = computed(() => {
	return store.getters['app/info']
});
const loading = ref(false);
const newFile = {
	name: "",
	proto: "tcp",
}
const file = ref(_.cloneDeep(newFile));

const getEndpoints = () => {
	const _users = [];
	fileService.getEndpoints()
		.then(res => {
			console.log("Endpoints:")
			console.log(res)
			endpoints.value = res || [];
			endpoints.value.forEach((ep)=>{
				_users.push(ep.username);
			});
			users.value = Array.from(new Set(_users));
		})
		.catch(err => console.log('Request Failed', err)); 
}
const enabled = computed(() => {
	return !!file.value.name
	&& ( 
		(outbounds.value.length>0) 
		|| (inbounds.value.length>0)  
	);
});
const addInEnabled = computed(() => {
	return inbound.value.listens.length>0 && !!inbound.value.listens[0]?.value && inbound.value.ep;
});
const addOutEnabled = computed(() => {
	return outbound.value.targets.length>0 && !!outbound.value.targets[0] && outbound.value.ep;
});
const error = ref();
const back = () => {
	emits('back')
}
const loaddata = () => {
	if(!props.d){
		file.value = _.cloneDeep(newFile);
	} else {
		file.value = props.d;
	}
	getEndpoints();
}

onMounted(() => {
	loaddata()
});
watch(()=>props.d,()=>{
	loaddata();
},{
	deep:true
})
</script>

<template>

	<div class="surface-ground h-full min-h-screen">
		<AppHeader :back="back">
				<template #center>
					 <Button icon="pi pi-arrow-right-arrow-left" text /> <b>{{props.d?`${props.d?.proto}/${props.d?.name}`:'New Tunnel'}}</b>
				</template>
				<template #end> 
					<Button v-if="!props.d" :loading="loading" :disabled="!enabled" label="Create" aria-label="Submit" size="small" @click="createTunnel"/>
				</template>
		</AppHeader>
		<div class="md:m-3 h-full relative">
			<ScrollPanel class="w-full absolute" style="top:0px;bottom: 0;">
				<Empty v-if="error" :error="error"/>
				<BlockViewer v-else containerClass="surface-section px-1 md:px-1 md:pb-7 lg:px-1" >
					<Loading v-if="loading" />
					<div v-else class="surface-ground surface-section h-full p-4" >
						<div class="mb-4" v-if="!props.d">
							<h6>
								<Tag>File</Tag>
							</h6>
							<div class="grid" >
								<div class="col-12 md:col-6">
									<FormItem label="Name" :border="false">
										<Chip class="pl-0 pr-3 mr-2">
												<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<i class="pi pi-bookmark"/>
												</span>
												<span class="ml-2 font-medium">
													<InputText :disabled="!!props.d" placeholder="Name your file" class="add-tag-input xxl" :unstyled="true" v-model="tunnel.name" type="text" />
												</span>
										</Chip>
									</FormItem>
								</div>
								<div class="col-12 md:col-6">
									<FormItem label="Protocol" :border="false">
										<Chip class="pl-0 pr-3">
												<span class="border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<RadioButton  :disabled="!!props.d" v-model="file.proto" inputId="scopeType2" name="scopeType" value="tcp" />
												</span>
												<span class="ml-2 font-medium">TCP</span>
										</Chip>
										<Chip class="ml-2 pl-0 pr-3">
												<span class="border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<RadioButton  :disabled="!!props.d" v-model="file.proto" inputId="scopeType3" name="scopeType" value="udp" />
												</span>
												<span class="ml-2 font-medium">UDP</span>
										</Chip>
									</FormItem>
								</div>
							</div>
						</div>
					</div>
				</BlockViewer>
			</ScrollPanel>
		</div>
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
</style>
