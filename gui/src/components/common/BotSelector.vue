<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import { platform } from '@/utils/platform';
import toast from "@/utils/toast";
import { useI18n } from 'vue-i18n';
import { useStore } from 'vuex';

const { t } = useI18n();
const props = defineProps(['multiple','modelValue','mesh','disabled','size','class']);
const emits = defineEmits(['select','update:modelValue']);

const store = useStore();
const bots = computed(() => store.getters["mcp/bots"]);
const loading = ref(false)
const filter = ref({
	keyword:'',
	limit:100,
	offset:0
})
const selectedTreeBots = ref({});
const selectBots = ref([]);
const selectBot = ref();
const select = () => {
	if(props.multiple == 'tree'){
		emits('select',selectedTreeBots.value);
		emits('update:modelValue',selectedTreeBots.value);
	} else if(!!props.multiple){
		emits('select',selectBots.value);
		emits('update:modelValue',selectBots.value);
	} else {
		emits('select',selectBot.value);
		emits('update:modelValue',selectBot.value);
	}
}
const treeFilter = ref('');
const selectFilter = (v) => {
	filter.value.keyword = v?.value||"";
}
const botsTree = computed(()=>{
	const _bots = [];
	bots.value.forEach((n,index)=>{
		_bots.push({
			key:n?.id,
			label:n?.name,
			data:n?.id,
		})
	});
	return Array.from(
	  new Map([..._bots].map(item => [item.key, item])).values()
	);
});

const botsMerge = computed(()=>{
	return Array.from(
	  new Map([...bots.value].map(item => [item.name, item])).values()
	);
});
const botsFilterPlus = computed(()=>{
	return !!botsMerge.value.find((u)=>u.key == filter.value.keyword)
});
watch(()=>props.modelValue,()=>{
	if(props.modelValue){
		let _bots = [];
		if(props.multiple == 'tree'){
			selectedTreeBots.value = props.modelValue
			_bots = Object.keys(props.modelValue);
		}else if(!!props.multiple){
			selectBots.value = props.modelValue
			_bots = props.modelValue;
		}else{
			selectBot.value = props.modelValue;
			_bots = props.modelValue;
		}
	}
},{deep:true,immediate:true});
const treeFilterPlus = computed(()=>{
	return !!botsTree.value.find((u)=>(u.label == filter.value.keyword || u.key == filter.value.keyword.split(' ').join('_')))
});
const addBot = () => {
	const id = filter.value.keyword.split(' ').join('_');
	selectBots.value.push(id)
	store.commit('mcp/addBot',{
		mesh: props.mesh,
		bot: {name:filter.value.keyword,id }
	})
	selectFilter({value:''})
	setTimeout(()=>{
		selectedTreeBots.value[id] = {checked:true};
		select();
	},300)
}
const removeBot = (bot) => {
	store.commit('mcp/deleteBot',{
		mesh: props.mesh,
		bot
	})
}
onMounted(()=>{
})
</script>

<template>
	<div v-if="props.multiple == 'tree'" >
	<div class="px-4 mt-4">
		<InputGroup >
			<InputGroupAddon><i class="pi pi-pencil"/></InputGroupAddon>
			<InputText  v-model="filter.keyword" :placeholder="t('New Bot')" @input="()=>{}"/>
			<InputGroupAddon><Button icon="pi pi-plus" style="border-radius: 0;" :disabled="treeFilterPlus || !filter.keyword"  @click="addBot" /></InputGroupAddon>
		</InputGroup>
	</div>
	<Tree 
		v-model:selectionKeys="selectedTreeBots" 
		:value="botsTree" 
		@node-select="select"
		selectionMode="checkbox" 
		class="w-full md:w-[30rem]">
		<template #nodeicon="slotProps">
			<Avatar shape="circle" icon="pi pi-prime" />
		</template>
		<template #default="slotProps">
			<div class="w-full flex">
				<b class="flex-item p-2">{{ slotProps.node?.label }}</b>
				<Tag v-if="'default' == slotProps.node.key" :value="t('Default')" class="ml-2" severity="secondary"/>
				<Button v-else severity="secondary" link size="small" icon="pi pi-trash" v-tooltip.right="t('Remove')" @click.stop="removeBot(slotProps.node.key)" />
			</div>
		</template>
	</Tree>
	</div>
	<MultiSelect 
		v-else-if="props.multiple" 
		@filter="selectFilter" 
		:class="props.class"
		:disabled="!!props.disabled"
		:size="props.size"
		maxSelectedLabels="2" 
		:loading="loading"  
		:resetFilterOnHide="true"
		:emptyMessage="t('No Bot')"
		v-model="selectBots" 
		@change="select" 
		:options="botsMerge" 
		optionLabel="name" 
		optionValue="id" 
		:filter="true" 
		:placeholder="t('Bots')"
	  :selectedItemsLabel="`${selectBots.length} ${t('Bots')}`" 
		style="max-width: 200px;" >
		<template #footer v-if="!botsFilterPlus && !!filter.keyword">
			<div class="text-center pb-2 px-3">
					<Button severity="secondary" class="w-full" size="small" icon="pi pi-plus" :label="t('Add')" @click.stop="addBot" />
			</div>
		</template>
		<template #option="slotProps">
			<i class="pi pi-prime mr-1"/>
			{{ slotProps.option.name }}
			<Tag v-if="'default' == slotProps.option.id" :value="t('Default')" class="ml-2" severity="contrast"/>
		</template>
	</MultiSelect>
	<Select
		v-else
		:disabled="!!props.disabled"
		v-model="selectBot"  
		:size="props.size"
		@change="select" 
		:emptyMessage="t('No Bot')"
		:options="botsMerge" 
		@filter="selectFilter" 
		:editable="true"
		:loading="loading"  
		optionLabel="name" 
		optionValue="id"
		:placeholder="t('Bot')"
		:class="props.class" >
			<template #option="slotProps">
				<i class="pi pi-prime mr-1"/>
				{{ slotProps.option.name }}
				<Tag v-if="'default' == slotProps.option.id" :value="t('Default')" class="ml-2" severity="contrast"/>
			</template>
	</Select>
</template>

<style scoped lang="scss">
</style>