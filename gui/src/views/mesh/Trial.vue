<script setup>
import { ref, onMounted,computed,watch } from "vue";
import { useRouter } from 'vue-router'
import ZtmService from '@/service/ZtmService';
import { useStore } from 'vuex';
import { useToast } from "primevue/usetoast";
import { useI18n } from 'vue-i18n';

const props = defineProps(['visible','loading']);
const emits = defineEmits(['update:visible','update:loading'])
const visibleTry = ref(false);
const { t } = useI18n();
const store = useStore();
const router = useRouter();
const ztmService = new ZtmService();

const username = ref("");
const tryMesh = () => {
	ztmService.identity().then((PublicKey)=>{
		if(!!PublicKey){
			emits('update:loading', true)
			ztmService.getPermit(PublicKey,username.value).then((permitJSON)=>{
				if(!!permitJSON){
					let saveData = {
						name: "",
						ca: "",
						agent: {
							name: "",
							certificate: "",
							privateKey: null,
						},
						bootstraps: []
					}
					
					saveData = {...saveData, ...permitJSON};
					saveData.name = "Sample";
					saveData.agent.name = username.value
					ztmService.joinMesh(saveData.name, saveData)
					.then(res => {
						emits('update:loading', false)
						if(!!res){
							visibleTry.value = false;
							toast.add({ severity: 'success', summary:'Tips', detail: 'Joined.', life: 3000 });
							loaddata();
						}
					})
					.catch(err => {
						emits('update:loading', false)
						console.log('Request Failed', err)
					});
				}
			}).catch((e)=>{
				emits('update:loading', false)
			});
		}
	})
}
watch(()=>props.visible,()=>{
	visibleTry.value = props.visible;
},{
	immediate:true,
	deep: true
});

watch(()=>visibleTry.value,()=>{
	if(props.visible != visibleTry.value){
		emits('update:visible', visibleTry.value)
	}
});

</script>

<template>
	<Dialog :header="t('Trial')" v-model:visible="visibleTry" modal :dismissableMask="true">
		<div>
			<div class="flex mt-2 w-full">
				<InputText size="small" :placeholder="t('Username')" v-model="username"  class="flex-item"></InputText>
				<Button :loading="props.loading" size="small" :disabled="!username || username == 'root'" :label="t('Join')" class="ml-2"  @click="tryMesh"></Button>
			</div>
			<div class="pt-2 opacity-70 text-sm">
				<i class="pi pi-info-circle relative" style="top: 1px;"/> {{t('Join our sample mesh for a first experience of ZTM')}}
			</div>
		</div>
	</Dialog>
</template>

<style scoped lang="scss">
</style>
