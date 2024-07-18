<script setup>
import { ref, onMounted,onActivated,watch, computed } from "vue";
import dayjs from 'dayjs';
import _ from 'lodash';
import relativeTime from 'dayjs/plugin/relativeTime';
import { FilterMatchMode } from 'primevue/api';
dayjs.extend(relativeTime)

const props = defineProps('d');
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

</script>

<template>
	<div class="grid text-left px-3 py-3" >
		<DataTable v-model:filters="filters" filterDisplay="menu" :globalFilterFields="['type', 'message']" removableSort class="w-full" :value="props.d" paginator :rows="10" :rowsPerPageOptions="[5, 10, 20, 50]" tableStyle="min-width: 50rem">
			
			<Column style="width: 160px;" header="Time" sortable field="time">
				<template #body="slotProps">
					{{timeago(slotProps.data.time)}}
				</template>
			</Column>
			<Column style="width: 80px;" header="Type" field="type" :showFilterMenu="true" :showFilterMatchModes="false" >
				<template #body="slotProps">
					<Tag :severity="severityMap(slotProps.data.type)">{{slotProps.data.type}}</Tag>
				</template>
				
				<template #filter="{ filterModel, filterCallback }">
						<Select v-model="filterModel.value" @change="filterCallback()" :options="statuses" placeholder="Select One" class="p-column-filter" style="min-width: 12rem" :showClear="true">
								<template #option="slotProps">
										<Tag :value="slotProps.option" :severity="getSeverity(slotProps.option)" />
								</template>
						</Select>
				</template>
			</Column>
			<Column header="Endpoint">
				<template #body="slotProps">
					{{endpoints.find((n)=>n.id == slotProps.data.ep)?.name}}
				</template>
			</Column>
			
			<Column header="Message">
				<template #body="slotProps">
					{{slotProps.data.message}}
				</template>
			</Column>
		</DataTable>
	</div>
</template>

<style scoped lang="scss">
</style>