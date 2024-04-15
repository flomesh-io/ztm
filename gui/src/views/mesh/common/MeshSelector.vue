<script setup>
import { ref, onMounted,onActivated, computed } from "vue";
import PipyProxyService from '@/service/PipyProxyService';
import store from "@/store";
const pipyProxyService = new PipyProxyService();
const selected = ref(null);
const props = defineProps({
	full: {
		type: Boolean,
		default: false
	},
	innerClass: {
		type: Boolean,
		default: 'transparent'
	},
	
});
const emits = defineEmits(['select']);
onMounted(() => {
	loaddata();
});

const meshes = computed(() => {
	return store.getters['account/meshes'] || []
});
const loaddata = () => {
	selected.value = meshes.value[0];
	emits('select',selected.value);
}


const select = () => {
	emits('select',selected.value);
}
</script>

<template>
	<Dropdown
		v-model="selected" 
		:options="meshes" 
		optionLabel="label" 
		@change="select"
		placeholder="Mesh" 
		:style="full?'':'max-width: 200px;'"
		:class="innerClass">
<!-- 				    <template #optiongroup="slotProps">
						<div class="flex align-items-center">
								<i class="pi pi-star-fill " style="color: orange;"/>
								<div>{{ slotProps.option.label }}</div>
						</div>
				</template> -->
				<template #option="slotProps">
						<div class="flex align-items-center">
								<span class="status-point run mr-3"/>
								<div>{{ decodeURI(slotProps.option.name) }}</div>
						</div>
				</template>
				 <template #value="slotProps">
							<div v-if="slotProps.value" class="flex align-items-center">
									<span class="status-point run mr-3"/>
									<div>{{ decodeURI(slotProps.value.name) }}</div>
							</div>
							<span v-else>
									{{ slotProps.placeholder }}
							</span>
					</template>
		</Dropdown>
</template>

<style scoped lang="scss">
</style>