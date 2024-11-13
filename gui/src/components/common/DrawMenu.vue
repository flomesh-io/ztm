<script setup>
import { ref, onMounted, watch, computed } from "vue";
import { useStore } from 'vuex';

const props = defineProps(['open','title','menus']);
const emits = defineEmits(['close','update:open'])
const store = useStore();
const visible = ref(false);
watch(()=>props.open,()=>{
	visible.value = !!props.open;
},{
	deep:true,
	immediate:true
})
const hide = () => {
	emits('update:open',false);
}
</script>

<template>
	
	<Drawer class="relative" @hide="hide" v-model:visible="visible" :header="title" position="bottom" style="height: 50%;">
		<div class="grid text-center" >
				<div  
					v-for="(menu) in menus"
					v-show="!menu?.hide"
					@click="menu.click" 
					class="py-4 relative text-center col-3 md:col-2" >
					<div class="grid-menu pt-4">
						<i :class="menu.icon" class="text-3xl" />
						<div class="mt-1" >
							{{menu.label}}
						</div>
					</div>
				</div>
		</div>
	</Drawer>
</template>

<style lang="scss" scoped>
</style>