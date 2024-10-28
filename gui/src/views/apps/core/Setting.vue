<script setup>
import { ref, computed, onMounted } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
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
	<div class="col-12 min-h-screen pl-0 pr-0" style="background: rgba(56, 4, 40, 0.9);">
		<AppHeader>
				<template #start>
					<Button @click="close" icon="pi pi-angle-left" severity="secondary" text />
				</template>
				<template #center>
					<b>Setting</b>
				</template>
				<template #end> 
					<Button text icon="pi pi-check" :loading="saving" :disabled="!port" v-tooltip="'Save'" @click="save"/>
				</template>
		</AppHeader>
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
						<div class="text-white flex-item" v-tooltip="db">
							{{db}}
						</div>
				</li>
				<li class="flex align-items-center py-3 px-2  surface-border flex-wrap">
						<div class="font-medium font-bold w-3 text-white"></div>
						<div class="flex-item">
							<Button  class="w-12rem" @click="openFinder">Show in finder <i class="pi pi-box ml-2"></i></Button>
						</div>
				</li>
			</ul>
		</div>
	</div>
</template>

<style lang="scss" scoped>
</style>
