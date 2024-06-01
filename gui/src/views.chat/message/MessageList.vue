<script setup>
import { ref, onMounted,onActivated,watch, computed } from "vue";
import { useStore } from 'vuex';
import Chat from "./Chat.vue"
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.locale('en', {
  relativeTime: {
    future: 'in %s',
    past: '%s',
    s: 'just',
    m: '1 min',
    mm: '%d mins',
    h: '1 hour',
    hh: '%d hours',
    d: '1 day',
    dd: '%d days',
    M: '1 mth',
    MM: '%d mths',
    y: '1 year',
    yy: '%d years',
  }
});
dayjs.extend(relativeTime)
const store = useStore();

onActivated(()=>{
})
const rooms = ref([
	{"text": "Hey, how are you?", "role": "user"},
	{"text": "I am doing great, thanks.", "role": "ai"},
	{"text": "What is the meaning of life?", "role": "user"},
	{"text": "Seeking fulfillment and personal growth.", "role": "ai"}
]);
const user = ref({ id: '123', name: 'John Doe' })

const sendMessage = (text) => {
	alert(text)
}
const handleFileUpload = (file) => {
}
const windowHeight = ref(window.innerHeight);
const viewHeight = computed(() => windowHeight.value - 45);
const timeago = computed(() => (ts) => {
	const date = new Date();
	return dayjs(date).fromNow();
})
const selectRoom = ref()
const toggleLeft = () => {
	store.commit('account/setMobileLeftbar', !store.getters['account/mobileLeftbar']);
}
</script>

<template>
	<div class="flex flex-row">
		<div :class="{'w-22rem':!!selectRoom,'w-full':!selectRoom,'mobile-hidden':!!selectRoom}">
				
		<AppHeader :main="true">
				<template #center>
					<b>Message (32)</b>
				</template>
		
				<template #end> 
					<Button icon="pi pi-plus"  @click="selectRoom = 1" />
				</template>
		</AppHeader>
		<DataView class="message-list" :value="rooms">
		    <template #list="slotProps">
		        <div @click="selectRoom = 1" class="flex flex-col message-item pointer" v-for="(item, index) in slotProps.items" :key="index">
							<div class="flex flex-col py-3 px-3 gap-4 w-full" :class="{ 'border-t border-surface-200 dark:border-surface-700': index !== 0 }">
									<div class="md:w-40 relative">
										<Badge value="2" severity="danger" class="absolute" style="right: -10px;top:-10px"/>
										<Avatar icon="pi pi-user" size="large" style="background-color: #ece9fc; color: #2a1261" />
										
									</div>
									<div class="flex-item">
											<div class="flex mt-1">
												<div class="flex-item">
													<b>client (root)</b>
												</div>
												<Status :run="true" style="top: 7px;margin-right: 0;right: -10px;"/>
											</div>
											<div class="flex mt-1">
												<div class="text-ellipsis flex-item">
													Hey, how are you?
												</div>
												<div class="w-3rem text-right text-tip opacity-60">
													{{timeago()}}
												</div>
											</div>
									</div>
							</div>
		        </div>
		    </template>
		</DataView>
		</div>
		<div v-if="selectRoom" class="flex-item">
			<div class="shadow mobile-fixed" >
				<Chat @back="() => selectRoom=false"/>
			</div>
		</div>
	</div>
</template>

<style lang="scss">
	
</style>