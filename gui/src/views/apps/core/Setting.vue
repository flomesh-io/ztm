<script setup>
import { ref, computed, onMounted } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import AppService from '@/service/AppService';
import toast from "@/utils/toast";
import ShellService from '@/service/ShellService';
import PipyVersion from '@/components/mesh/PipyVersion.vue';
import { getPort, setPort } from '@/service/common/request';

const emits = defineEmits(['close']);
const saving = ref(false);
const isRunning = ref(false);

const shellService = new ShellService();
const openFinder = () => {
	shellService.openFinder();
}
const db = ref('');
const loaddata = async () => {
	db.value = await shellService.getDB();
}
const port = ref(getPort());
const save = () => {
	setPort(port.value);
	
	toast.add({ severity: 'success', summary: 'Tips', detail: "Saved, Restart to activate.", life: 3000 });
}
const close = () => {
	emits('close');
}

onMounted(()=>{
	loaddata();
});
</script>

<template>
	<div class="col-12" style="padding-left: 0;padding-right: 0">
		<div>
			<ul class="list-none px-2 m-0">
				<li class="flex align-items-center py-3 px-2  surface-border flex-wrap">
					<div class="font-medium font-bold w-3 text-white">Version</div>
					<PipyVersion />
				</li>
				<li class="flex align-items-center py-3 px-2  surface-border flex-wrap">
						<div class="font-medium font-bold w-3 text-white">Port</div>
						<InputGroup class="search-bar" style="border-radius: 8px;" >
							<InputNumber :useGrouping="false" class="drak-input bg-gray-900 text-white flex-1" :min="0" :max="65535" placeholder="0-65535" v-model="port" />
							<Button size="small" icon="pi pi-sort" />
						</InputGroup>
				</li>
				<li class="flex align-items-center py-3 px-2  surface-border flex-wrap">
						<div class="font-medium font-bold w-3 text-white">DB</div>
						<div class="text-white" v-tooltip="db" style="white-space: nowrap;text-overflow: ellipsis;overflow: hidden;width: 300px;">
							{{db}}
						</div>
				</li>
				<li class="flex align-items-center py-3 px-2  surface-border flex-wrap">
						<div class="font-medium font-bold w-3 text-white"></div>
						<div >
							<Button  class="w-12rem" @click="openFinder">Show in finder <i class="pi pi-box ml-2"></i></Button>
						</div>
				</li>
			</ul>
		</div>
		<div class="px-3 mt-4">
			<div class="text-center flex">
				<div class="flex-item pr-2">
					<Button severity="secondary" class="w-full" style="height: 30px;" @click="close" label="Back"/>
				</div>
				<div class="flex-item pl-2" >
					<Button :loading="saving" class="w-full" style="height: 30px;" :disabled="!port" label="Save" @click="save"/>
				</div>
			</div>
		</div>
	</div>
</template>

<style lang="scss" scoped>
</style>
