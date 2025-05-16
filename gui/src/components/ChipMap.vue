<script setup>
import { ref, watch, useSlots } from 'vue';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
const slots = useSlots();
const props = defineProps({
	map: {
			type: Object,
			default: ()=>{
				return {};
			}
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
const list = ref([])
const emits = defineEmits(['change','update:map']);
const emitVal = () => {
	let map = {}
	if(list.value.length>0){
		list.value.forEach((n)=>{
			map[n.key] = n.value
		})
	};
	emits("change",map);
	emits("update:map",map);
}

const newMap = ref({key:'',value:''});
const newTag = (tag) => {
	list.value.push({key:'',value:''});
	emitVal()
}
const removeTag = (index) => {
	list.value.splice(index,1);
	emitVal();
}
watch(() => props.map, () =>{
	if(!props.map){
		emits("update:map",{});
	} else {
		let oldMap = {}
		if(list.value.length>0){
			list.value.forEach((n)=>{
				oldMap[n.key] = n.value
			})
		}
		if(JSON.stringify(oldMap) != JSON.stringify(props.map)){
			list.value = []
			Object.keys(props.map).forEach((key)=>{
				list.value.push({
					key, value: props.map[key]
				})
			})
		}
	}
},{
	deep:true,
	immediate:true
})
</script>

<template>
	<span class="flex flex-column" style="gap: 5px;">
		<div v-if="list.length > 0" v-for="(tag,tagidx) in list">
		<!-- 	<Chip v-if="tagidx<list.length - 1" class="pl-0 custom-chip">
				<span class="bg-primary border-circle flex align-items-center justify-content-center">
					<Badge :value="tagidx+1" />
				</span>
				<span class="ml-2 font-medium">
					<span>{{tag.key}}: {{tag.value}}</span>
					<i class="pi pi-times-circle" @click="removeTag(k)"/>
				</span>
			</Chip> -->
			<div>
				<InputGroup>
					<InputGroupAddon>
						<Badge :value="tagidx+1" />
					</InputGroupAddon>
					<InputText class="text-center" :placeholder="t('Key')" :unstyled="true" v-model="tag.key" @input="emitVal" type="text" />
					<InputText class="text-center" :placeholder="t('Value')" :unstyled="true" v-model="tag.value" @input="emitVal" type="text" />
					<InputGroupAddon>
						<Button @click="removeTag(tagidx)" icon="pi pi-minus" severity="secondary" />
					</InputGroupAddon>
					<InputGroupAddon v-if="(tagidx + 1) == list.length">
						<Button @click="newTag()" icon="pi pi-plus" severity="secondary" />
					</InputGroupAddon>
				</InputGroup>
				
			</div>
		</div>
		<Button v-else size="small" @click="newTag()" icon="pi pi-plus" severity="secondary" />
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