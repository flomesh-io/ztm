<script setup>
import { ref,onMounted,computed, onBeforeUnmount,defineExpose } from 'vue';
import ScriptService from '../service/ScriptService';
import JsEditor from '@/components/editor/JsEditor.vue';
import { useRoute } from 'vue-router'
import { useStore } from 'vuex';
import { useToast } from "primevue/usetoast";

const toast = useToast();
const props = defineProps(['loading','scriptsHide'])
const emits = defineEmits(['response','update:loading','update:scriptsHide','reload'])
const route = useRoute();
const scriptService = new ScriptService();
const store = useStore();
const args = ref([])
const pjs = ref('println(pipy.argv)');
const name = ref('');
const info = computed(() => {
	return store.getters['app/info']
});

const selectEp = ref(info.value.endpoint?.id);
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
const endpoints = ref([]);
const getEndpoints = () => {
	scriptService.getEndpoints()
		.then(res => {
			console.log("Endpoints:")
			console.log(res)
			endpoints.value = res || [];
		})
		.catch(err => console.log('Request Failed', err)); 
}
const windowHeight = ref(window.innerHeight);
const viewHeight = computed(() => windowHeight.value - 85);
onMounted(()=>{
	name.value = '';
	getEndpoints();
})
const show = () => {
	emits('update:scriptsHide',false);
}

const setPjs = (value) =>{
	pjs.value = value?.script
}

defineExpose({ setPjs })
</script>

<template>
	<div  class="relative h-full min-h-screen w-full" >
		<AppHeader :main="true" >
				<template #start>
					
					<Button v-tooltip="'Show Favorites'" v-if="props.scriptsHide" icon="pi pi-eye" aria-haspopup="true" aria-controls="op" @click="show"/>
					<Button icon="pi pi-star" text aria-haspopup="true" aria-controls="op" @click="toggle"/>
				</template>
				<template #center>
					<b>Pjs</b>
				</template>
		
				<template #end> 
					<Select
						v-model="selectEp" 
						:options="endpoints" 
						optionLabel="name" 
						optionValue="id"
						placeholder="Endpoint" 
						class="flex"></Select>
					<Button :loading="props.loading" v-tooltip="'Execute'" icon="pi pi-send" @click="run"/>
				</template>
		</AppHeader>
		
		<Popover class="ml-6 mt-3" ref="op" appendTo="self">
				<InputText size="small" placeholder="As Name" v-model="name"  class="w-20rem"></InputText>
				<Button size="small" icon="pi pi-save" class="ml-2"  @click="addScript"></Button>
		</Popover>
		<JsEditor
		  id="pluginScript"
		  v-model:value="pjs"
			:height="`${viewHeight}px`"
		/>
		<div style="background: #2e2e2e;color:#fff;position: absolute;left: 0;right: 0;bottom: 0;" class="p-2 container_pannel flex">
			<b class="w-4rem p-2">Args:</b>
			<div class="flex-item">
				<ChipList placeholder="Arg" v-model:list="args" />
			</div>
		</div>
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
