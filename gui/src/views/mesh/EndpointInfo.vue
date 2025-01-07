<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
const props = defineProps(['ep','loading']);
const windowWidth = computed(() =>  window.innerWidth);
const isMobile = computed(() => windowWidth.value<=768);
</script>

<template>
	<Loading v-if="props.loading" />
	<div v-else-if="props.ep" class="md:m-3">
		<BlockViewer containerClass="surface-section px-1 md:px-1 lg:px-1" >
			<div >
				<ul class="list-none p-0 m-0">
					<FormItem :label="t('Name')">
						<Chip class="pl-0 pr-3 mr-2">
								<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
									<i class="pi pi-bookmark"/>
								</span>
								<span class="ml-2 font-medium">
									{{props.ep?.name || t('Unknow')}}
								</span>
						</Chip>
					</FormItem>
					<FormItem :label="t('Username')">
						<Chip class="pl-0 pr-3 mr-2">
								<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
									<i class="pi pi-user"/>
								</span>
								<span class="ml-2 font-medium">
									{{props.ep?.username || t('Unknow')}}
								</span>
						</Chip>
					</FormItem>
					<FormItem label="IP" v-if="props.ep?.ip">
						<Chip class="pl-0 pr-3 mr-2">
								<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
									<i class="pi pi-map-marker"/>
								</span>
								<span class="ml-2 font-medium">
									{{props.ep?.ip || t('Unknow')}}
								</span>
						</Chip>
					</FormItem>
					<FormItem :label="t('Port')" v-if="props.ep?.port">
						<Chip class="pl-0 pr-3 mr-2">
								<span class="bg-primary border-circle w-2rem h-2rem flex align-items-center justify-content-center">
									<i class="pi pi-sort"/>
								</span>
								<span class="ml-2 font-medium">
									{{props.ep?.port || t('Unknow')}}
								</span>
						</Chip>
					</FormItem>
				</ul>
			</div>
		</BlockViewer>
	</div>
	<Empty v-else :title="t('Unknow EP')" :error="props.error"/>
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
</style>
