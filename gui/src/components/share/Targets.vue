<script setup>
import { ref, onMounted,watch, computed } from "vue";
import { useStore } from 'vuex';
import gptSvg from "@/assets/img/gpt.png";
import _ from "lodash";

const props = defineProps(['a']);
const emits = defineEmits(['send'])
const store = useStore();
const selectedMesh = computed(() => {
	return store.getters["account/selectedMesh"]
});
const rooms = computed(() => store.getters["notice/rooms"]);
const uniRooms = computed(() => {
	let rtn = _.cloneDeep(rooms.value);
	let index = rtn.findIndex(item => item.peer == selectedMesh.value?.agent?.username);
	if (index != -1) {
	  let node = rtn.splice(index, 1)[0];
	  rtn.unshift(node);
	} else {
		rtn.unshift({
			peer: selectedMesh.value?.agent?.username,
		})
	}
	return rtn;
});

const loadrooms = () => {
	store.dispatch('notice/rooms');
}

const send = (item) => {
	emits('send', item)
}
watch(()=>selectedMesh,()=>{
	if(selectedMesh.value){
		loadrooms();
	}
},{
	deep:true,
	immediate:true
})
</script>

<template>
	
	<div class="px-3 pt-3 pb-1 opacity-60"><b>{{selectedMesh?.name}} recent chats</b></div>
	<DataView class="message-list" :value="uniRooms">
			<template #list="slotProps">
					<div @click="send(item)" class="flex flex-col message-item pointer" v-for="(item, index) in slotProps.items" :key="index">
						<div class="flex flex-col py-3 px-3 gap-4 w-full" :class="{ 'border-t border-surface-200 dark:border-surface-700': index !== 0 }">
								<div class="md:w-20 relative">
									<img v-if="item.isAi" :src="gptSvg" width="20" height="20" />
									<Avatar v-else-if="!!item.group" icon="pi pi-users" size="small"  />
									<Avatar v-else-if="selectedMesh?.agent?.username == item.peer" icon="pi pi-tablet" size="small"  />
									<Avatar v-else icon="pi pi-user" size="small"  />
									
								</div>
								<div class="flex-item" style="line-height: 25px;">
										<div class="flex" v-if="!!item?.peer">
											<div class="flex-item" >
												<b>{{item?.peer}}</b>
											</div>
											<Status :run="true" style="top: 7px;margin-right: 0;right: -10px;"/>
										</div>
										<div class="flex" v-else>
											<div class="flex-item" >
												<b>{{item.name}}</b>
											</div>
										</div>
								</div>
						</div>
					</div>
			</template>
		</DataView>
</template>

<style lang="scss" scoped>
</style>