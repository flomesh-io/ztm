<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
    list: {
        type: Array,
        default: ()=>{
					return [];
				}
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

const tags = ref(props.list);
watch(()=>{
	return props.list
},()=>{
	tags.value = props.list;
},{
	deep:true
});
const newTag = ref("");
const addTag = () => {
	if(!!newTag.value){
		tags.value.push(newTag.value);
		newTag.value = "";
		emits("update:list",tags.value);
		emits("change",tags.value);
	}
}

const emits = defineEmits(['change','update:list']);
const removeTag = (index) => {
	tags.value.splice(index,1);
	emits("update:list",tags.value);
	emits("change",tags.value);
}
</script>

<template>
    <Chip class="mr-2 custom-chip" v-for="(tag,tagidx) in list">
			{{tag}}
			<i class="pi pi-times-circle" @click="removeTag(tagidx)"/>
		</Chip>
    <Chip class="pl-0 pr-3">
        <span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
    			<i class="pi" :class="icon"/>
    		</span>
        <span class="ml-2 font-medium">
    			<InputText @keyup.enter="addTag" :placeholder="placeholder" class="add-tag-input" :unstyled="true" v-model="newTag" type="text" />
					<i class="pi pi-arrow-down-left" />
				</span>
    </Chip>
</template>

<style scoped lang="scss">
	.custom-chip{
		line-height: 24px;
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