<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from 'vue-router'
import PipyProxyService from '@/service/PipyProxyService';
import HubApplications from './HubApplications.vue';
const router = useRouter();
import store from "@/store";
const pipyProxyService = new PipyProxyService();

const clients = ref([]);
onMounted(() => {
	clients.value = [{
		name: "FA:E9:52:9B:EF:A6",
	},{
		name: "FA:E9:52:9B:EF:A6",
	}];
	// loadTag();
	store.commit('account/setClient', null);
	// pipyProxyService.clients()
	// 	.then(res => {
	// 		clients.value = res?.data;
	// 		loadTag();
	// 	})
	// 	.catch(err => console.log('Request Failed', err)); 
});

const tags = ref([]);

const changeTag = () => {
	localStorage.setItem('tagList', JSON.stringify(tags.value));
}
const loadTag = () => {
	const tagJSON = !!localStorage.getItem('tagList')?JSON.parse(localStorage.getItem('tagList')):{};
	tags.value = tagJSON;
	clients.value.forEach((user)=>{
		if(!tags.value.hasOwnProperty(user)){
			tags.value[user] = [];
		}
	})
}
const network = (id) => {
	router.push(`/server/network/${id}`)
}
const hostinfo = (id) => {
	router.push(`/server/hostinfo/${id}`)
}
const testtool = (id) => {
	router.push(`/server/testtool/${id}`)
}
const hoverClient = ref();
const setHover = (key) =>{
	hoverClient.value = key;
}
</script>

<template>
	
	<TabView class="pt-3 pl-3 pr-3">
		<TabPanel >
			<template #header>
				<div class="flex align-items-center gap-2" style="padding-right: 5px;margin-right: 10px;">
					<i class="pi pi-bookmark" />	Subscriptions
				</div>
			</template>
			<DataView :value="clients">
					<template #list="slotProps">
							<div class="grid grid-nogutter pt-3">
									<div v-for="(item, index) in slotProps.items" :key="index" class="col-12 card mb-3">
											<div class="flex flex-column xl:flex-row xl:align-items-start p-4 gap-4">
													<!-- <img class="w-9 sm:w-16rem xl:w-10rem shadow-2 block xl:block mx-auto border-round" :src="`https://primefaces.org/cdn/primevue/images/product/${item.image}`" :alt="item.name" /> -->
													<Avatar icon="pi pi-desktop" class="right-icon" size="xlarge"  />
													<div class="flex flex-column sm:flex-row justify-content-between align-items-center xl:align-items-start flex-1 gap-4">
															<div class="flex flex-column align-items-center sm:align-items-start gap-3">
																	<div class="text-2xl font-bold text-900">{{ item.name }}</div>
																	<div class="flex align-items-center">
																			<ChipList  v-model:list="tags[item]" @change="changeTag"/>
																	</div>
															</div>
															<div class="flex flex-row align-items-center sm:align-items-end gap-3 sm:gap-2">
																	<Button severity="secondary" @mouseenter="setHover('hostinfo'+index)" @click="hostinfo(item)" icon="pi pi-info" rounded :label="hoverClient == ('hostinfo'+index)?'Host Info':null"></Button>
																	<Button severity="secondary" @mouseenter="setHover('network'+index)" @click="network(item)" icon="pi pi-globe" rounded :label="hoverClient == ('network'+index)?'Network':null"></Button>
																	<!-- <Button @mouseenter="setHover('testtool'+index)" @click="testtool(item)" icon="pi pi-wifi" rounded :label="hoverClient == ('testtool'+index)?'Test Tool':null"></Button> -->
																	<Button severity="danger"  @mouseenter="setHover('remove'+index)" @click="hostinfo(item)" icon="pi pi-times" rounded :label="hoverClient == ('remove'+index)?'Remove':null"></Button>
															</div>
													</div>
											</div>
									</div>
							</div>
					</template>
			</DataView>
		</TabPanel>
		<TabPanel>
			<template #header>
				<div class="flex align-items-center gap-2" v-badge.danger="'3'" style="padding-right: 5px;margin-right: 10px;">
					<i class="pi pi-user" />	Applications
				</div>
			</template>
			
			<div class="surface-section">
				<!-- <div class="text-500 mb-5">xxx</div> -->
				<div class="card" >
					<HubApplications />
				</div>
			</div>
		</TabPanel>
	</TabView>
</template>

<style scoped lang="scss">
::v-deep(.p-dataview-content) {
  background-color: transparent !important;
}

:deep(.p-tabview-nav),
:deep(.p-tabview-panels),
:deep(.p-tabview-nav-link){
	background: transparent !important;
}
</style>
