<script setup>
import { ref, onMounted,onActivated, computed,watch } from "vue";
import ScriptService from '../service/ScriptService';

const scriptService = new ScriptService();
const emits = defineEmits(['hide','edit'])
const hide = () => {
	emits('hide');
}
const remove = (script) => {
	scriptService.removeScript(script?.name);
	loaddata();
}
const edit = (s) => {
	emits('edit',s);
}
const loaddata = () => {
	
	scriptService.getPubScripts((res)=>{
		scripts.value = res || [];
		scripts.value = scripts.value.concat(scriptService.getScripts());
	})
}
const scripts = ref([]);
onMounted(()=>{
	loaddata();
})
</script>

<template>
	<div class="flex flex-row min-h-screen "  :class="{'embed-ep-header':false}">
		<div  class="relative h-full min-h-screen w-full" >
			<AppHeader :main="true" >
					<template #start>
						<Button icon="pi pi-eye-slash" @click="hide" />
					</template>
					<template #center> 
						<b>Favorites</b>
					</template>
			</AppHeader>
			<ScrollPanel class="w-full absolute" style="bottom: 0;"  :style="{'top':'35px'}" v-if="scripts && scripts.length >0">
			<div class="text-center">
				
				<div class="grid text-left mt-1 px-3" v-if="scripts && scripts.length >0">
						<div  :class="'col-12'" v-for="(script,hid) in scripts" :key="hid">
							 <div class="surface-card shadow-2 p-3 border-round">
									 <div class="flex justify-content-between">
											 <div>
													<span class="block text-tip font-medium mb-3"><Tag severity="contrast" class="mr-1">{{script?.name}}</Tag></span>
													<div class="text-left w-full" >
														<Tag @click="edit(script)" v-tooltip="'Use'" class="pointer">
															<span class="text-ellipsis" style="max-width: 120px;" >
																<i class="pi pi-code text-tip relative" style="top: 2px;"></i> {{script.script}}
															</span>
														</Tag> 
													</div>
											 </div>
											 <div class="flex" v-if="!script.public">
												 <div @click="remove(script)" class="pointer flex align-items-center justify-content-center p-button-secondary border-round" style="width: 2rem; height: 2rem">
													<i class="pi pi-trash text-tip text-xl"></i>
												 </div>
											 </div>
									 </div>
							 </div>
					 </div>
				</div>
				<Menu ref="actionMenu" :model="actions" :popup="true" />
			</div>
			</ScrollPanel>
			<b v-else class="w-full text-center block opacity-60" style="margin-top: 60%;">
				Empty
			</b>
		</div>
	</div>
</template>

<style scoped lang="scss">
</style>