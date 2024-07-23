<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { merge } from '@/service/common/request';
import ProxyService from '../service/ProxyService';
import { useRoute } from 'vue-router'
import { useToast } from "primevue/usetoast";
import { useStore } from 'vuex';
import _ from "lodash"
const props = defineProps(['ep']);
const emits = defineEmits(['save','back']);
const store = useStore();
const route = useRoute();
const toast = useToast();
const proxyService = new ProxyService();
const info = computed(() => {
	return store.getters['app/info']
});
const loading = ref(false);
const newConfig = {
	listen: "",
	targets: [],
}
const config = ref(_.cloneDeep(newConfig));

const error = ref();
const back = () => {
	emits('back')
}
const create = () => {
	proxyService.setProxy({
		ep: props?.ep?.id,
		listen: config.value.listen,
		targets: config.value.targets
	}).then((res)=>{
		toast.add({ severity: 'success', summary:'Tips', detail: 'Save successfully.', life: 3000 });
		setTimeout(()=>{
			emits("save",config.value);
		},1000);
	})
}
const loaddata = () => {
	proxyService.getProxy(props?.ep?.id).then((res)=>{
		config.value.listen = res.listen;
		config.value.targets = res.targets;
	})
}
onMounted(() => {
	loaddata();
});
</script>

<template>

	<div class="surface-ground h-full" :style="{'minHeight':`calc(100vh - ${props.embed?'100px':'20px'})`}">
		<AppHeader :back="back">
				<template #center>
					<b v-if="!!props.ep">{{ props.ep.name|| 'Unknow EP' }}</b>
					<span v-else>Loading...</span>
				</template>
				<template #end> 
					<span v-if="!!props.ep" class="mr-2 relative" style="top: -1px;"><Tag v-if="props.ep.id == info.endpoint?.id" severity="contrast" >Local</Tag></span>
					<Button :loading="loading" label="Save" aria-label="Submit" size="small" @click="create"/>
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
								<Tag>Proxy</Tag>
							</h6>
							<div class="grid" >
								<div class="col-12 p-0">
									<FormItem label="Listen" :border="false">
										<Chip class="pl-0 pr-3 mr-2">
												<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
													<i class="pi pi-sort"/>
												</span>
												<span class="ml-2 font-medium">
													<InputText :unstyled="true" v-model="config.listen"  class="add-tag-input xxl"  placeholder="Listen (HOST:PORT)" />
												</span>
										</Chip>
									</FormItem>
								</div>
								<div class="col-12 p-0">
									<FormItem label="Targets" :border="false">
										<ChipList direction="v" icon="pi pi-link" :id="`outbound-targets-${index}`" placeholder="Add" v-model:list="config.targets" />
										<div class="absolute mt-2 opacity-60">
											egs: '*', '0.0.0.0/0'
										</div>
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
