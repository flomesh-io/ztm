
<template>
	<DataTable :value="applications" tableStyle="min-width: 50rem">
			<template #header>
					<div class="flex flex-wrap align-items-center justify-content-between gap-2">
							<span class="text-xl text-900 font-bold">Applications</span>
							<Button icon="pi pi-refresh" rounded raised />
					</div>
			</template>
			<Column field="client" header="Client"></Column>
			<Column field="time" header="Time">
					<template #body="slotProps">
							{{slotProps.data.time.toISOString()}}
					</template>
			</Column>
			<Column header="Status">
					<template #body="slotProps">
							<Tag v-if="slotProps.data.status!='Waiting'" :value="slotProps.data.status" :severity="getSeverity(slotProps.data)" />
							<span v-else >
								<Button class="mr-2" icon="pi pi-times" severity="danger" text rounded />
								<Button icon="pi pi-check" severity="success" text rounded />
							</span>
					</template>
			</Column>
			<template #footer> In total there are {{ applications ? applications.length : 0 }} applications. </template>
	</DataTable>
</template>

<script setup>
import { ref, onMounted } from 'vue';

onMounted(() => {
    applications.value = [{
			client: 'lindongchendeMacBook-Pro.local',
			time: new Date(),
			status:'Approved'
		},{
			client: 'lindongchendeMacBook-Pro.local',
			time: new Date(),
			status:'Waiting'
		},{
			client: 'lindongchendeMacBook-Pro.local',
			time: new Date(),
			status:'Refused'
		}];
});

const applications = ref();
const formatCurrency = (value) => {
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};
const getSeverity = (application) => {
    switch (application.status) {
        case 'Approved':
            return 'success';

        case 'Waiting':
            return 'warning';

        case 'Refused':
            return 'danger';

        default:
            return null;
    }
};

</script>
