<script setup>
import { ref, watch, useSlots } from 'vue';

const slots = useSlots();
const props = defineProps({
	list: {
			type: Array,
			default: ()=>{
				return [];
			}
	},
	direction: {
			type: String,
			default: 'h'
	},
	listType: {
			type: String,
			default: null
	},
	listKey: {
			type: String,
			default: null
	},
	readonly: {
			type: Boolean,
			default: false
	},
	placeholder: {
			type: String,
			default: 'Add'
	},
	icon: {
			type: String,
			default: 'pi-pencil'
	},
});
watch(() => props.list, () =>{
	if(!props.list){
		emits("update:list",[]);
	}
	if(props.list.length == 0 && props.listType != 'tag'){
		
		// if(!props.listKey){
		// 	props.list.push('')
		// }else{
		// 	const _temp = {};
		// 	_temp[props.listKey] = ""
		// 	props.list.push(_temp);
		// }
	}
},{
	deep:true,
	immediate:true
})
const newTag = ref('');
const addTag = (tag) => {
	if(props.listType == 'tag'){
		if(!!tag){
			props.list.push(tag);
			newTag.value = "";
		}
	}else if(!props.listKey){
		if(!!tag){
			props.list.push("");
		}
	} else {
		if(!!tag[props.listKey]){
			const _temp = {};
			_temp[props.listKey] = ""
			props.list.push(_temp);
		}
	}
	emits("change",props.list);
}
const emits = defineEmits(['change','update:list']);
const removeTag = (index) => {
	props.list.splice(index,1);
	emits("change",props.list);
}
const typing = (e,idx) => {
	if(!props.listKey){
		props.list[idx] = e.target.value;
	} else {
		props.list[idx][props.listKey] = e.target.value;
	}
}
const initEmptyList = () => {
	if(!props.listKey){
		props.list.push('');
	} else {
		const epy = {}
		epy[props.listKey]='';
		props.list.push(epy);
	}
}
const edit = ref({});
const values = ref([]);
const saveVal = (idx) => {
	if(values.value[idx] != '' && props.list[idx]){
		if(!!props?.listKey){
			props.list[idx][props.listKey] = values.value[idx];
		} else {
			props.list[idx] = values.value[idx];
		}
	}
}
const openEdit = (idx,tag) => {
	edit.value[idx] = true;
	if(!!props?.listKey){
		values.value[idx] = tag[props.listKey]
	} else {
		values.value[idx] = tag
	}
} 
</script>

<template>
	
	<span v-if="props.listType == 'tag'">
		<span v-for="(tag,tagidx) in props.list">
			<Tag severity="secondary" v-if="tagidx<props.list.length" class="mr-2 my-1" >
				<span v-if="!props.listKey">{{tag}}</span><span v-else>{{tag[props.listKey]}}</span>
				<i v-if="!props.readonly" class="pi pi-times-circle ml-2 opacity-50" @click.stop="removeTag(tagidx)"/>
			</Tag>
		</span>
		
		<Tag v-if="!props.readonly" severity="secondary" class="pl-0 pr-3 my-1">
				<span class="ml-2  font-medium">
					<InputText @click.stop="()=>{}" @keyup.enter="addTag(newTag)" :placeholder="placeholder" class="add-tag-input" style="width:100px" :unstyled="true" v-model="newTag"  type="text" />
					<i class="pi pi-arrow-down-left" />
				</span>
		</Tag>
	</span>
	<Button v-else-if="!props.list?.length" size="small" @click="initEmptyList" icon="pi pi-plus" severity="secondary" />
	<span v-else>
		<span v-if="props.direction == 'h'" v-for="(tag,tagidx) in props.list">
			<Chip v-if="tagidx<props.list.length - 1" class="mr-2 custom-chip" >
				<span v-if="!props.listKey">{{tag}}</span><span v-else>{{tag[props.listKey]}}</span>
				<i class="pi pi-times-circle" @click="removeTag(tagidx)"/>
			</Chip>
			<Chip v-else-if="!slots.input" class="pl-0 custom-chip">
					<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
						<i class="pi" :class="icon"/>
					</span>
					<span class="ml-2 font-medium">
						<InputText v-if="!props.listKey" @keyup.enter="addTag(tag)" :placeholder="placeholder" class="add-tag-input xl" :unstyled="true" :value="tag" @input="typing($event,tagidx)" type="text" />
						<InputText v-else @keyup.enter="addTag(tag)" :placeholder="placeholder" class="add-tag-input xl" :unstyled="true" :value="tag[props.listKey]" @input="typing($event,tagidx)" type="text" />
						<i class="pi pi-arrow-down-left" />
					</span>
					<span class="font-medium">
						<i class="pi pi-times-circle" @click="removeTag(tagidx)"/>
					</span>
			</Chip>
			<slot v-else name="input"/>
		</span>
		<div v-else v-for="(tag,tagidx) in props.list">
			<Chip v-if="tagidx<props.list.length - 1" class="pl-0 custom-chip">
				<span @click="openEdit(tagidx,tag)" class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center pointer">
					<i class="pi" :class="!edit[tagidx]?'pi-pencil':icon"/>
				</span>
				<span v-if="!edit[tagidx]" class="ml-2 font-medium">
					<span class="vm" v-if="!props.listKey" @click="openEdit(tagidx,tag)">{{tag}}</span>
					<span class="vm" v-else  @click="openEdit(tagidx,tag)">{{tag[props.listKey]}}</span>
					<Button class="ml-2 vm" size="small" @click="removeTag(tagidx)" icon="pi pi-minus" severity="secondary" />
				</span>
				<span v-else class="ml-2 font-medium">
					<InputText @input="saveVal(tagidx)" @keyup.enter="edit[tagidx] = false;"  class="add-tag-input xl" :unstyled="true" v-model="values[tagidx]" type="text" />
					<i class="pi pi-arrow-down-left" />
				</span>
			</Chip>
			<Chip v-else-if="!slots.input" class="pl-0 custom-chip">
					<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
						<i class="pi" :class="icon"/>
					</span>
					<span class="ml-2 font-medium">
						<InputText v-if="!props.listKey" @keyup.enter="addTag(tag)" :placeholder="placeholder" class="add-tag-input xl" :unstyled="true" :value="tag" @input="typing($event,tagidx)" type="text" />
						<InputText v-else @keyup.enter="addTag(tag)" :placeholder="placeholder" class="add-tag-input xl" :unstyled="true" :value="tag[props.listKey]" @input="typing($event,tagidx)" type="text" />
						<i class="pi pi-arrow-down-left" />
					</span>
					<Button size="small" @click="removeTag(tagidx)" icon="pi pi-minus" severity="secondary" />
					<Button :disabled="tag==''" size="small" @click="addTag(tag)" icon="pi pi-plus" severity="secondary" />
			</Chip>
			<slot v-else name="input"/>
		</div>
	</span>
</template>

<style scoped lang="scss">
	.custom-chip{
		line-height: 24px;
		margin-bottom: 10px;
	}
	.custom-chip .pi-times-circle{
		opacity: 0.5;
		transition: .3s all;
		cursor: pointer;
		position: relative;
		margin-left: 5px;
		vertical-align: middle;
	}
	.custom-chip .pi-times-circle:hover{
		opacity: 0.8;
	}
	.pi-arrow-down-left{
		opacity: 0.5;
		font-size: 10px;
	}
</style>