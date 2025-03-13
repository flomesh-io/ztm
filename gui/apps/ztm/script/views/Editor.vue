<script setup>
import { ref,onMounted,computed, onBeforeUnmount,defineExpose } from 'vue';
import ScriptService from '../service/ScriptService';
import JsEditor from '@/components/editor/JsEditor.vue';
import { useRoute } from 'vue-router'
import { useStore } from 'vuex';
import { useToast } from "primevue/usetoast";
import { platform } from '@/utils/platform';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();

const toast = useToast();
const props = defineProps(['loading','scriptsHide','isMobile'])
const emits = defineEmits(['response','update:loading','update:scriptsHide','reload','show'])
const route = useRoute();
const scriptService = new ScriptService();
const store = useStore();
const args = ref([])
const pjs = ref("println('Hello, world!')");
const name = ref('');
const info = computed(() => {
	return store.getters['app/info']
});

const selectEp = ref(info.value?.endpoint?.id);
const run = () => {
	emits('response',{});
	emits('update:loading',true);
	scriptService.postScript({
		script: pjs.value,
		args: args.value,
		ep: selectEp.value
	})
		.then(res => {
			emits('response',{data:res || `No result with args ${JSON.stringify(args.value)}`});
			setTimeout(()=>{
				emits('update:loading',false);
			},500)
		})
		.catch(err => {
			emits('response',{error:err});
			setTimeout(()=>{
				emits('update:loading',false);
			},500)
		}); 
    
}
const addScript = () => {
	scriptService.saveScript(name.value, pjs.value);
	toast.add({ severity: 'success', summary:'Tips', detail: 'Collected.', life: 3000 });
	emits('reload');
}
const op = ref();
const toggle = (event) => {
	op.value.toggle(event);
}
const windowHeight = ref(window.innerHeight);
const viewHeight = computed(() => windowHeight.value - 80);
onMounted(()=>{
	name.value = '';
})
const show = () => {
	emits('show');
	emits('update:scriptsHide',false);
}

const setPjs = (value) =>{
	pjs.value = value?.script
}

const back = () => {
	if(window.parent){
		window.parent.location.href="/#/mesh/apps";
	}else{
		location.href="/#/mesh/apps";
	}
}
const showBack = computed(()=>{
	return platform() == 'ios' || platform() == 'android' || platform() == 'web'
})
defineExpose({ setPjs })
</script>

<template>
	<div  class="relative h-full min-h-screen w-full" >
		<AppHeader >
				<template #start>
					<Button v-if="showBack" @click="back" icon="pi pi-angle-left" severity="secondary" text />
					<Button v-tooltip="t('Show Favorites')" v-if="props.scriptsHide || props.isMobile" icon="pi pi-list-check" aria-haspopup="true" aria-controls="op" @click="show"/>
					<Button icon="pi pi-star" text aria-haspopup="true" aria-controls="op" @click="toggle"/>
				</template>
				<template #center>
					<b>{{t('Script')}}</b>
				</template>
		
				<template #end> 
					<EpSelector 
						:app="true" 
						:multiple="false" 
						:endpoint="info?.endpoint" 
						v-model="selectEp" />
					<Button :loading="props.loading" v-tooltip="t('Execute')" icon="pi pi-send" @click="run"/>
				</template>
		</AppHeader>
		
		<Popover class="ml-6 mt-3" ref="op" appendTo="self">
				<InputText size="small" :placeholder="t('As Name')" v-model="name"  class="w-20rem"></InputText>
				<Button size="small" icon="pi pi-save" class="ml-2"  @click="addScript"></Button>
		</Popover>
		
		<div style="background: #1e1e1e;color:#fff;" class="p-2 container_pannel flex">
			<b class="w-7rem p-2">{{t('Arguments')}}</b>
			<div class="flex-item">
				<ChipList :placeholder="`${t('Argument')} ${args.length}`" v-model:list="args" />
			</div>
		</div>
		<JsEditor
		  id="pluginScript"
		  v-model:value="pjs"
			:height="`${viewHeight}px`"
		/>
	</div>
</template>

<style scoped lang="scss">
::v-deep(.p-breadcrumb){
	border-radius: 0;
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
