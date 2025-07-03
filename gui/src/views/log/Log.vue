<script setup>
import { ref, onMounted,onActivated,watch, computed } from "vue";
import _ from 'lodash';
import { dayjs,extend } from '@/utils/dayjs';
import { FilterMatchMode } from '@primevue/core/api';
import { useI18n } from 'vue-i18n';
import { isMobileWidth } from '@/utils/platform';
const { t, locale } = useI18n();
extend(locale.value)
const props = defineProps(['d','endpoints']);
const severityMap = computed(() => (severity) => {
	if(severity == 'error'){
		return "danger";
	} else if(severity == 'warn'){
		return "warning";
	} else if(severity == 'debug'){
		return "contrast";
	} else {
		return severity;
	}
})
const timeago = computed(() => (ts) => {
	if(!!ts){
		const date = new Date(ts);
		return dayjs(date).fromNow();
	} else {
		return "None";
	}
})

const getSeverity = (status) => {
    switch (status) {
        case 'error':
            return 'danger';

        case 'warn':
            return 'warn';

        case 'info':
            return 'info';
    }
}
const statuses = ref(['error','warn','info'])
const filters = ref({
    type: { value: null, matchMode: FilterMatchMode.EQUALS }
});

const logs = computed(() => props.d || []);

const isMobile = computed(isMobileWidth);
</script>

<template>
		<DataTable scrollable :size="isMobile?'small':''" v-model:filters="filters" filterDisplay="menu" :globalFilterFields="['type', 'message']" removableSort class="w-full" paginator :rows="10" :rowsPerPageOptions="[5, 10, 20, 50]"  :value="logs" tableStyle="min-width: 50rem">
			<Column frozen style="width: 100px;" :header="t('Time')" sortable field="time">
				<template #body="slotProps">
					{{timeago(slotProps.data.time)}}
				</template>
			</Column>
			<Column style="width: 100px;" :header="t('Type')" field="type" :showFilterMenu="true" :showFilterMatchModes="false" >
				<template #body="slotProps">
					<Tag :severity="severityMap(slotProps.data.type)">{{slotProps.data.type}}</Tag>
				</template>
				
				<template #filter="{ filterModel, filterCallback }">
						<Select v-model="filterModel.value" @change="filterCallback()" :options="statuses" :placeholder="t('Select')" class="p-column-filter" style="min-width: 12rem" :showClear="true">
								<template #option="slotProps">
										<Tag :value="slotProps.option" :severity="getSeverity(slotProps.option)" />
								</template>
						</Select>
				</template>
			</Column>
			<Column :header="t('Endpoint')"  v-if="!!props.endpoints && props.endpoints.length>0">
				<template #body="slotProps">
					{{props.endpoints.find((n)=>n.id == slotProps.data.ep)?.name}}
				</template>
			</Column>
			
			<Column :header="t('Message')">
				<template #body="slotProps">
					{{slotProps.data.message}}
				</template>
			</Column>
		</DataTable>
</template>

<style scoped lang="scss">
</style>