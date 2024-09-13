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
const emits = defineEmits(['back']);
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
}

onMounted(() => {
	loaddata()
});
watch(()=>props.d,()=>{
	loaddata();
},{
	deep:true
})
const active = ref(0)
</script>

<template>

	<div class="surface-ground h-full min-h-screen relative">
		<AppHeader :back="back">
				<template #center>
					 <Button icon="pi pi-inbox" text /> 
					 <b>Downloads</b> <Badge v-if="!props.downloads" :value="props.downloads.length"/>
				</template>
				<template #end> 
					<!-- <Button v-if="!props.d" :loading="loading" :disabled="!enabled" label="Create" aria-label="Submit" size="small" @click="createTunnel"/> -->
				</template>
		</AppHeader>
		<ScrollPanel class="absolute-scroll-panel" style="bottom: 0;">
			<Loading v-if="loading" />
			<div v-else-if="props.downloads.length>0" class="px-4 py-2">
				<div v-for="(item, index) in props.downloads" :key="index" class="flex p-2" >
					<div class="pr-3">
						<img v-tooltip="item.hash" class="relative" :src="checker({...item,name:item.path})" width="30" height="30" style="top: 5px;"/>
					</div>
					<div class="flex-item text-left">
						<div>
							<b class="mr-2" style="word-break: break-all;">{{ item.path }}</b>
						</div>
						<div >
							<ProgressBar :value="item.downloading*100<30?30:item.downloading*100" style="height: 14px;">
								{{bitUnit(item.size*item.downloading)}}  / {{bitUnit(item.size)}}
							</ProgressBar>
						</div>
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
