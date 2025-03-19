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
const treeFilter = ref('');
const selectFilter = (v) => {
	filter.value.keyword = v?.value||"";
	getUsers();
}
const appendUsers = ref([]);
const usersTree = computed(()=>{
	const _users = [];
	users.value.forEach((user,index)=>{
		_users.push({
			key:user?.name,
			label:user?.name,
			data:user?.name,
		})
	});
	const _users2 = [];
	appendUsers.value.forEach((user,index)=>{
		_users2.push({
			key:user?.name,
			label:user?.name,
			data:user?.name,
		})
	});
	return Array.from(
	  new Map([..._users, ..._users2].map(item => [item.key, item])).values()
	);
});

const usersMerge = computed(()=>{
	return Array.from(
	  new Map([...users.value, ...appendUsers.value].map(item => [item.name, item])).values()
	);
});
const usersFilterPlus = computed(()=>{
	return !!usersMerge.value.find((u)=>u.key == filter.value.keyword)
});
watch(()=>props.modelValue,()=>{
	if(props.modelValue){
		let _users = [];
		if(props.multiple == 'tree'){
			selectedTreeUsers.value = props.modelValue
			_users = Object.keys(props.modelValue);
		}else if(!!props.multiple){
			selectUsers.value = props.modelValue
			_users = props.modelValue;
		}else{
			selectUser.value = props.modelValue;
			_users = props.modelValue;
		}
		_users.forEach((_user)=>{
			appendUsers.value.push({name:_user})
		})
	}
},{deep:true,immediate:true});
const treeFilterPlus = computed(()=>{
	return !!usersTree.value.find((u)=>u.key == filter.value.keyword)
});
const addUser = ()=>{
	appendUsers.value.push({name:filter.value.keyword});
	selectedTreeUsers.value[filter.value.keyword] = {checked:true};
	selectUsers.value.push(filter.value.keyword)
	selectFilter({value:''})
	select();
}
onMounted(()=>{
	getUsers();
})
</script>

<template>
	<div v-if="props.multiple == 'tree'" >
	<div class="px-4 mt-4">
		<InputGroup >
			<InputGroupAddon><i class="pi pi-search"/></InputGroupAddon>
			<InputText  v-model="filter.keyword" :placeholder="t('User')" @input="getUsers()"/>
			<InputGroupAddon><Button icon="pi pi-plus" severity="secondary" :disabled="treeFilterPlus || !filter.keyword"  @click="addUser" /></InputGroupAddon>
		</InputGroup>
	</div>
	<Tree 
		
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
		:emptyMessage="t('No User')"
		v-model="selectUsers" 
		@change="select" 
		:options="usersMerge" 
		optionLabel="name" 
		optionValue="name" 
		:filter="true" 
		:placeholder="t('Users')"
	  :selectedItemsLabel="`${selectUsers.length} ${t('Users')}`" 
		style="max-width: 200px;" >
		<template #footer v-if="!usersFilterPlus && !!filter.keyword">
			<div class="text-center pb-2 px-3">
					<Button severity="secondary" class="w-full" size="small" icon="pi pi-plus" :label="t('Add')" @click.stop="addUser" />
			</div>
		</template>
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
		:options="usersMerge" 
		@filter="selectFilter" 
		:editable="true"
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