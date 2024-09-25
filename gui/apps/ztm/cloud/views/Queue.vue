<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { merge } from '@/service/common/request';
import FileService from '../service/FileService';
import { useRoute } from 'vue-router'
import { useToast } from "primevue/usetoast";
import { useStore } from 'vuex';
import { checker, bitUnit } from '@/utils/file';
import _ from "lodash"
const props = defineProps(['downloads','uploads']);
const emits = defineEmits(['back','load']);
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

const enabled = computed(() => {
	return true;
});
const error = ref();
const back = () => {
	emits('back')
}
const loaddata = () => {
	emits('load')
}

onMounted(() => {
	loaddata()
});
watch(()=>props.d,()=>{
	loaddata();
},{
	deep:true
})

const doCancelDownload = (item) => {
	if(item.path){
		fileService.cancelDownload(item.path,(error)=>{
			loaddata();
			if(!error){
				toast.add({ severity: 'contrast', summary:'Tips', detail: `Cancelled.`, life: 3000 });
			}
		});
	}
}
const active = ref(0)
</script>

<template>

	<div class="surface-ground h-full min-h-screen relative">
		<AppHeader :back="back">
				<template #center>
					 <b>Downloads</b>
				</template>
				<template #end> 
					<Button  :severity="!props.downloads.length?'secondary':'primary'">
						<i :class="!props.downloads.length?'pi pi-inbox':'pi pi-spinner pi-spin'"/>
						<Badge v-if="!!props.downloads.length" :value="props.downloads.length" size="small"></Badge>
					</Button>
					<!-- <Button v-if="!props.d" :loading="loading" :disabled="!enabled" label="Create" aria-label="Submit" size="small" @click="createTunnel"/> -->
				</template>
		</AppHeader>
		<ScrollPanel class="absolute-scroll-panel" style="bottom: 0;">
			<Loading v-if="loading" />
			<div v-else-if="props.downloads.length>0" class="px-4 py-2">
				<div v-for="(item, index) in props.downloads" :key="index" class="flex p-2" >
					<div class="pr-3">
						<img v-tooltip.right="item.hash" class="relative" :src="checker({...item,name:item.path})" width="30" height="30" style="top: 5px;"/>
					</div>
					<div class="flex-item text-left text-sm" >
						<div>
							<b class="mr-2" style="word-break: break-all;">{{ item.path }} </b>
						</div>
						<div >
							<ProgressBar v-tooltip.bottom="item?.error" :class="item?.error?'error':''" :value="item.downloading*100" style="height: 8px;">
								<span></span>
							</ProgressBar>
							<div class="flex">
								<div class="flex-item">
									{{bitUnit(item.size*item.downloading)}}  / {{bitUnit(item.size)}} 
								</div>
								<div v-if="!!item?.speed || !!item?.downloading">
									{{bitUnit(item?.speed||0)}}/s
								</div>
								<div v-else>
									{{!!item?.error?'Error':'Waiting'}}
								</div>
							</div>
						</div>
						<div v-if="item?.error" style="word-break: break-all;font-size: 8pt;">
							<i class="pi pi-info-circle text-red-500 mr-1 relative" style="top: 3px;" />
							{{item.error}}
						</div>
					</div>
					<div class="pt-2 pl-2">
						<Button @click="doCancelDownload(item)" text icon="pi pi-times" severity="danger"  />
					</div>
				</div>
			</div>
			<Empty v-else :error="error"/>
		</ScrollPanel>
	</div>
</template>

<style scoped lang="scss">
	:deep(.p-tabview-panels){
		background-color: transparent;
	}
</style>
