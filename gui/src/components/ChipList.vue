<script setup>
import { ref, watch } from 'vue';

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
	if(props.list.length == 0){
		props.list.push('')
	}
},{
	deep:true,
	immediate:true
})
const addTag = (tag) => {
	if(!!tag){
		props.list.push("");
	}
	emits("change",props.list);
}
const emits = defineEmits(['change','update:list']);
const removeTag = (index) => {
	props.list.splice(index,1);
	emits("change",props.list);
}
const typing = (e,idx) => {
	props.list[idx] = e.target.value;
}
</script>

<template>
		<span v-if="props.direction == 'h'" v-for="(tag,tagidx) in props.list">
			<Chip v-if="tagidx<props.list.length - 1" class="mr-2 custom-chip" >
				{{tag}}
				<i class="pi pi-times-circle" @click="removeTag(tagidx)"/>
			</Chip>
			<Chip v-else class="pl-0 pr-3">
					<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
						<i class="pi" :class="icon"/>
					</span>
					<span class="ml-2 font-medium">
						<InputText @keyup.enter="addTag(tag)" :placeholder="placeholder" class="add-tag-input xl" :unstyled="true" :value="tag" @input="typing($event,tagidx)" type="text" />
						<i class="pi pi-arrow-down-left" />
					</span>
			</Chip>
		</span>
		<div v-else v-for="(tag,tagidx) in props.list">
			<Chip v-if="tagidx<props.list.length - 1" class="pl-0 custom-chip">
				<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
					<i class="pi" :class="icon"/>
				</span>
				<span class="ml-2 font-medium">
					{{tag}}
					<i class="pi pi-times-circle" @click="removeTag(tagidx)"/>
				</span>
			</Chip>
			<Chip v-else class="pl-0 pr-3">
					<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
						<i class="pi" :class="icon"/>
					</span>
					<span class="ml-2 font-medium">
						<InputText @keyup.enter="addTag(tag)" :placeholder="placeholder" class="add-tag-input" :unstyled="true" :value="tag" @input="typing($event,tagidx)" type="text" />
						<i class="pi pi-arrow-down-left" />
					</span>
			</Chip>
		</div>
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