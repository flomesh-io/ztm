<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import { platform } from '@/utils/platform';
import toast from "@/utils/toast";
import { useI18n } from 'vue-i18n';
import ZtmService from '@/service/ZtmService';

const { t } = useI18n();
const ztmService = new ZtmService();
const props = defineProps(['multiple','modelValue','mesh','disabled','app','user','size','class']);
const emits = defineEmits(['select','update:modelValue']);

const users = ref([]);
const loading = ref(false)
const filter = ref({
	keyword:'',
	limit:100,
	offset:0
})
const currentUser = computed(()=>{
	if(!!props.app){
		return {name:props.user}
	}else{
		return {name:props.mesh?.agent?.username}
	}
})
const getUsers = (callback) => {
	loading.value = true;
	if(!filter.value.keyword && users.value.length == 0 && props.mesh){
		users.value = [currentUser.value]
	}
	ztmService.getUsers(props.mesh?.name,filter.value)
		.then(res => {
			users.value = res || [];
			loading.value = false;
		})
		.catch(err => {
			loading.value = false;
		}); 
}
const selectedTreeUsers = ref({});
const selectUsers = ref([]);
const selectUser = ref();
const select = () => {
	if(props.multiple == 'tree'){
		emits('select',selectedTreeUsers.value);
		emits('update:modelValue',selectedTreeUsers.value);
	} else if(!!props.multiple){
		emits('select',selectUsers.value);
		emits('update:modelValue',selectUsers.value);
	} else {
		emits('select',selectUser.value);
		emits('update:modelValue',selectUser.value);
	}
}
const selectFilter = (v) => {
	filter.value.keyword = v?.value||"";
	getUsers();
}
const usersTree = computed(()=>{
	const _users = [];
	users.value.forEach((user,index)=>{
		_users.push({
			key:user?.name,
			label:user?.name,
			data:user?.name,
		})
	});
	return _users;
})
watch(()=>props.modelValue,()=>{
	if(props.modelValue){
		if(props.multiple == 'tree'){
			selectedTreeUsers.value = props.modelValue
		}else if(!!props.multiple){
			selectUsers.value = props.modelValue
		}else{
			selectUser.value = props.modelValue
		}
	}
},{deep:true,immediate:true});
onMounted(()=>{
	getUsers();
})
</script>

<template>
	<Tree 
		v-if="props.multiple == 'tree'" 
		:filter="true" 
		@filter="selectFilter" 
		filterMode="lenient" 
		v-model:selectionKeys="selectedTreeUsers" 
		:value="usersTree" 
		@node-select="select"
		selectionMode="checkbox" 
		class="w-full md:w-[30rem]">
		<template #nodeicon="slotProps">
				<UserAvatar :username="slotProps.node?.label" size="20"/>
		</template>
		<template #default="slotProps">
				<b class="px-2">{{ slotProps.node?.label }}</b>
		</template>
	</Tree>
	<MultiSelect 
		v-else-if="props.multiple" 
		@filter="selectFilter" 
		:class="props.class"
		:disabled="!!props.disabled"
		:size="props.size"
		maxSelectedLabels="2" 
		:loading="loading"  
		:emptyMessage="t('No User')"
		v-model="selectUsers" 
		@change="select" 
		:options="users" 
		optionLabel="name" 
		optionValue="name" 
		:filter="true" 
		:placeholder="t('Users')"
	  :selectedItemsLabel="`${selectUsers.length} ${t('Users')}`" 
		style="max-width: 200px;" >
		<template #option="slotProps">
			<i class="pi pi-user mr-1"/>
			{{ slotProps.option.name }}
			<Tag v-if="currentUser.name == slotProps.option.name" value="Me" class="ml-2" severity="contrast"/>
		</template>
	</MultiSelect>
	<Select
		v-else
		:disabled="!!props.disabled"
		v-model="selectUser"  
		:size="props.size"
		@change="select" 
		:emptyMessage="t('No User')"
		:options="users" 
		@filter="selectFilter" 
		:loading="loading"  
		optionLabel="name" 
		optionValue="name"
		:placeholder="t('User')"
		:class="props.class" >
			<template #option="slotProps">
				<i class="pi pi-user mr-1"/>
				{{ slotProps.option.name }}
				<Tag v-if="currentUser.name == slotProps.option.name" value="Me" class="ml-2" severity="contrast"/>
			</template>
	</Select>
</template>

<style scoped lang="scss">
</style>