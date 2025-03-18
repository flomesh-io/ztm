<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { merge } from '@/service/common/request';
import ProxyService from '../service/ProxyService';
import { useRoute } from 'vue-router'
import { useToast } from "primevue/usetoast";
import { useStore } from 'vuex';
import _ from "lodash"
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
const props = defineProps(['ep']);
const emits = defineEmits(['save','back']);
const store = useStore();
const route = useRoute();
const toast = useToast();
const proxyService = new ProxyService();
const info = computed(() => {
	return store.getters['app/info']
});
const loading = ref(false);
const newConfig = {
	listen: "",
	targets: [],
	exclusions: [],
	rules:[]
}
const config = ref(_.cloneDeep(newConfig));


const error = ref();
const back = () => {
	emits('back')
}
const save = () => {
	loading.value = true;
	const rules = config.value?.rules;
	const _data = {
		ep: props?.ep?.id,
		listen: config.value.listen,
		targets: config.value.targets,
		exclusions: config.value.exclusions,
	}
	if(rules && rules.length>0){
		rules.forEach(rule => {
			rule.targets = rule.targetsStr?rule.targetsStr.split("\n").join(";").split(";"):[];
			delete rule.targetsStr;
			if(!rule.users?.length){
				delete rule.users
			}
			if(!rule.groups?.length){
				delete rule.groups
			}
		});
		_data.rules = rules;
	}
	proxyService.setProxy(_data).then((res)=>{
		loading.value = false;
		toast.add({ severity: 'success', summary:'Tips', detail: 'Save successfully.', life: 3000 });
		setTimeout(()=>{
			emits("save",config.value);
		},1000);
	}).catch((e)=>{
		loading.value = false;
	})
}

const groups = ref([]);
const getGroups = () => {
	proxyService.getGroups().then((res)=>{
		groups.value = res || [];
	})
}
const loaddata = () => {
	proxyService.getProxy(props?.ep?.id).then((res)=>{
		config.value.listen = res.listen || "";
		config.value.targets = res.targets || [];
		config.value.exclusions = res.exclusions || [];
		if(res?.rules && res.rules.length>0){
			config.value.rules = res.rules;
			config.value.rules.forEach(rule => {
				rule.targetsStr = (rule?.targets||[]).join("\n")
			})
		} else {
			config.value.rules =  [];
		}
	})
	getGroups();
}
onMounted(() => {
	loaddata();
});
const placeholder = ref(t('domain | ip')+`...`);
const newRule = {
	users:[],
	groups:[],
	action:'allow',
	targets: ['*'],
	targetsStr: '*',
}
const rule = ref(_.cloneDeep(newRule))
const addRule = () => {
	config.value.rules.push(rule.value);
	rule.value = _.cloneDeep(newRule);
}
const changeEnableRoutingRules = () => {
	setTimeout(()=>{
		if(!!enableRoutingRules.value){
			config.value.rules = [];
		} else if(config.value.rules) {
			delete config.value.rules;
		}
	},300)
}
const ruleType = ref(t('Users'))
</script>

<template>

	<div class="surface-ground h-full min-h-screen relative">
		<AppHeader :back="back">
				<template #center>
					<span v-if="!!props.ep" class="mr-2 relative" style="top: -1px;"><Tag v-if="props.ep.id == info.endpoint?.id" severity="contrast" >{{t('Local')}}</Tag></span>
					<b v-if="!!props.ep">{{ props.ep.name|| t('Unknow EP') }}</b>
					<span v-else>{{t('Loading')}}...</span>
				</template>
				<template #end> 
					<Button :loading="loading" icon="pi pi-check" :label="t('Save')" aria-label="Submit" size="small" @click="save"/>
				</template>
		</AppHeader>
		<ScrollPanel class="absolute-scroll-panel md:p-3" style="bottom: 0;">
			<Empty v-if="error" :error="error"/>
			<BlockViewer v-else containerClass="surface-section py-2" >
				<Loading v-if="loading" />
				<div v-else class="surface-ground surface-section h-full p-4" >
					<div class="mb-4" v-if="!props.d">
						<div class="grid w-full" >
							<div class="col-12 p-0">
								<FormItem :label="t('Listen')" :border="false">
									<Chip class="pl-0 pr-3 mr-2">
											<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
												<i class="pi pi-sort"/>
											</span>
											<span class="ml-2 font-medium">
												<InputText :unstyled="true" v-model="config.listen"  class="add-tag-input xxl"  :placeholder="t('ip:port')" />
											</span>
									</Chip>
								</FormItem>
							</div>
						</div>
						<div class="grid mt-2 w-full" >
							<div class="col-12 md:col-6 p-0">
								<FormItem :label="t('Targets')" :border="false">
									<ChipList addClass="" direction="v" icon="pi pi-link" :id="`targets-${index}`" :placeholder="t('domain | ip')" v-model:list="config.targets" />
									
								</FormItem>
							</div>
							<div class="col-12 md:col-6 p-0">
								<FormItem :label="t('Exclusions')" :border="false">
									<ChipList addClass="w-full" direction="v" icon="pi pi-link" :id="`exclusions-${index}`" :placeholder="t('domain | ip')" v-model:list="config.exclusions" />
									
								</FormItem>
							</div>
						</div>
						<div class="absolute opacity-60" style="padding-left: 100px;margin-top: -10px;">
							e.g. '*.example.com' | '0.0.0.0/0'
						</div>
						<div class="grid mt-5 w-full" >
							<div class="col-12 p-0" >
								<FormItem :label="t('Rules')" :border="false">
									<InputList 
									:d="config.rules"
									:attrs="newRule"
									:min="0"
									class="flex w-full">
										<template #default="{ item, listIndex }">
											<div class="pb-3 w-full flex">
												<Badge class="mr-1" style="margin-top: 10px;" :value="listIndex+1"/>
												<div class="p-1">
													<SelectButton class="w-10rem" size="small" v-model="item.action" optionValue="value" optionLabel="label" :options="[{label:t('Allow'),value:'allow'},{label:t('Deny'),value:'deny'}]" />
												</div>
												<div  class="p-1" >
													<FloatLabel>
														<UserSelector
															:app="true" 
															size="small"
															:multiple="true" 
															style="min-width: 150px;"
															:user="info?.username" 
															placeholder=""
															v-model="item.users" />
														<label >{{(!item.users?.length && !item.groups?.length)?t('All Users'):t('Users')}}</label>
													</FloatLabel>
												</div>
												<div  class="p-1">
													<FloatLabel>
														<MultiSelect size="small" class="w-full" style="min-width: 150px;" v-model="item.groups" :options="groups"  placeholder="" optionLabel="name" optionValue="id"/>
														<label >{{(!item.users?.length && !item.groups?.length)?t('All Groups'):t('Groups')}}</label>
													</FloatLabel>
												</div>
												<div class="flex-item p-1">
													<FloatLabel>
														<Textarea class="w-full"  v-model="item.targetsStr" rows="3" cols="20" />
														<label>{{t('Targets')}}</label>
													</FloatLabel>
													<div class="opacity-60" v-if="listIndex+1 == config.rules.length">
														e.g. '*.example.com;0.0.0.0/0'
													</div>
												</div>
											</div>
										</template>
									</InputList>
								</FormItem>
							</div>
						</div>
					</div>
				</div>
			</BlockViewer>
		</ScrollPanel>
	</div>
</template>

<style scoped lang="scss">
:deep(.p-breadcrumb){
	border-radius: 0;
	border-left: none;
	border-right: none;
}
.bootstrap{
	:deep(.add-tag-input){
		width:120px;
	}
	:deep(.add-tag-input:hover){
		width:160px;
	}
}

:deep(.text-tip){
	width: 100px !important;
	padding-right: 10px !important;
}
</style>
