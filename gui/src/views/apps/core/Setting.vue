<script setup>
import { ref, computed, onMounted } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import toast from "@/utils/toast";
import { platform } from '@/utils/platform';
import ShellService from '@/service/ShellService';
import ZtmService from '@/service/ZtmService';
import confirm from "@/utils/confirm";
import PipyVersion from '@/components/mesh/PipyVersion.vue';
import { getPort, setPort } from '@/service/common/request';
import { useI18n } from 'vue-i18n';
const { t, locale } = useI18n();
const emits = defineEmits(['close']);
const saving = ref(false);
const isRunning = ref(false);

const shellService = new ShellService();
const ztmService = new ZtmService();
const openFinder = () => {
	shellService.openFinder();
}
const db = ref('');

const defaultLang = ref(locale.value=='en');
const changeLang = () => {
	locale.value = defaultLang.value?'en':'zh';
	localStorage.setItem('lang',locale.value);
}
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
const reset = () => {
	ztmService.resetPrivateKey(()=>{})
}
onMounted(()=>{
	loaddata();
});
</script>

<template>
	<div class="col-12 min-h-screen pl-0 pr-0 pt-0" style="background: rgba(56, 4, 40, 0.9);">
		<AppHeader>
				<template #start>
					<Button @click="close" icon="pi pi-angle-left" severity="secondary" text />
				</template>
				<template #center>
					<b>{{t('Setting')}}</b>
				</template>
				<template #end> 
					<Button text icon="pi pi-check" :loading="saving" :disabled="!port" v-tooltip="'Save'" @click="save"/>
				</template>
		</AppHeader>
		<div>
			<ul class="list-none px-2 m-0">
				<li class="flex align-items-center py-3 px-2  surface-border flex-wrap">
					<div class="font-medium font-bold w-3 text-white">{{t('Version')}}</div>
					<PipyVersion />
				</li>
				<li class="flex align-items-center py-3 px-2  surface-border flex-wrap">
						<div class="font-medium font-bold w-3 text-white">{{t('Port')}}</div>
						<InputGroup class="search-bar" style="border-radius: 8px;" >
							<InputNumber :useGrouping="false" class="drak-input bg-gray-900 text-white flex-1" :min="0" :max="65535" placeholder="0-65535" v-model="port" />
							<Button size="small" icon="pi pi-sort" />
						</InputGroup>
				</li>
				<li class="flex align-items-center py-3 px-2  surface-border flex-wrap">
						<div class="font-medium font-bold w-3 text-white">{{t('DB')}}</div>
						<div v-if="platform() != 'ios' && platform() != 'android'" class="text-white flex-item" v-tooltip="db">
							{{db}}
						</div>
						<div v-else class="text-white flex-item" v-tooltip="db">
							$DOCUMENT/ztmdb
						</div>
						<div v-if="platform() != 'ios' && platform() != 'android'">
							<Button @click="openFinder" icon="pi pi-folder-open" />
						</div>
				</li>
				<li class="flex align-items-center py-3 px-2  surface-border flex-wrap">
					<div class="font-medium font-bold w-3 text-white">{{t('Lang')}}</div>
					<ToggleButton size="small" @change="changeLang" v-model="defaultLang" onLabel="EN" offLabel="中文" />
				</li>
				<li class="flex align-items-center py-3 px-2  surface-border flex-wrap">
						<div class="flex-item">
							<Button size="small" severity="secondary" icon="pi pi-refresh" class="w-full opacity-70" @click="reset" :label="t('Reset Private Key')" />
						</div>
				</li>
			</ul>
		</div>
	</div>
</template>

