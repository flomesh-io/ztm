<script setup>

import { ref, reactive, h, watch, computed, onMounted, onBeforeMount } from 'vue';
import * as echarts from 'echarts';
import PipyProxyService from '@/service/PipyProxyService';
import SqlService from '@/service/SqlService';
import { FilterMatchMode, FilterOperator } from 'primevue/api';
import store from "@/store";
import dayjs from 'dayjs';
import { useRoute } from 'vue-router'
const route = useRoute();
const pipyProxyService = new PipyProxyService();
const sqlService = new SqlService();
const docHeight = ref(document.documentElement.clientHeight - 46);
const dataSource = ref([]);

const detail = "";
const sortField = ref("request_begin_time");
const sortOrder = ref(-1);
const total = ref(0);
const current = ref(0);
const pageSize = ref(20);

const home = ref({
    icon: 'pi pi-desktop'
});

const visibleRight = ref(false);
const visibleBottom = ref(false);
const playing = ref(false);
const selected = ref();
const selectRowData = ref({});
const metaKey = ref(true);

let defaultStartDate = new Date();
defaultStartDate.setDate(defaultStartDate.getDate()-2)
const range = ref([defaultStartDate,new Date()]);
const filters = ref(null);
const protocols = ref(['http', 'https', 'smtp', 'ftp', 'etc']);
const groupBy = ref({ name: 'Host', code: 'h.host' });
const groupByOptions = ref([
    { name: 'Host', code: 'h.host' },
    { name: 'Client Ip', code: 'c.client_ip' },
    { name: 'Protocol', code: 's.protocol' },
    { name: 'Status', code: 'h.status' },
    { name: 'Request Size', code: 's.request_size' },
    { name: 'Response Size', code: 's.response_size' },
]);


const getBitUnit = (value)=> {
	if(value>(1024 * 1024 * 1024)){
		return (value/(1024 * 1024 * 1024)).toFixed(2) + "GB";
	} else if(value>(1024 * 1024)){
		return (value/(1024 * 1024)).toFixed(2) + "MB";
	} else if(value>1024){
		return (value/1024).toFixed(2) + "KB";
	} else {
		return value*1 + "B";
	}
}
const getTimeUnit = (value)=> {
	if(value>(1000 * 60 * 60)){
		return (value/(1000 * 60 * 60)).toFixed(2) + "h";
	} else if(value>(1000 * 60)){
		return (value/(1000 * 60)).toFixed(2) + "min";
	} else if(value>1000){
		return (value/1000).toFixed(2) + "s";
	} else {
		return value*1 + "ms";
	}
}


const renderLeftChart = (data) => {
	let _data = data || [];
	if(_data.length >= 0){
		let _all = {
			// make an record to fill the bottom 50%
			value: 0,
			itemStyle: {
				// stop the chart from rendering this piece
				color: 'none',
				decal: {
					symbol: 'none'
				}
			},
			label: {
				show: false
			}
		}
		data.forEach((item)=>{
			_all.value += item.value *1;
		});
		_data.push(_all);
	}
	
	const option = {
		tooltip: {
			trigger: 'item'
		},
		legend: {
			type: 'scroll',
			top: '5%',
			left: '0%',
			orient: 'vertical',
			// doesn't perfectly work with our tricks, disable it
			selectedMode: false
		},
		series: [
			{
				type: 'pie',
				radius: ['40%', '70%'],
				center: ['100%', '45%'],
				// adjust the start angle
				startAngle: 270,
				label: {
					show: true,
					formatter(param) {
						// correct the percentage
						return param.name + ' (' + param.percent * 2 + '%)';
					}
				},
				data: _data
			}
		]
	};
	var dom = document.getElementById('left-chart');
	var chart = echarts.init(dom);
	chart.setOption(option);
}

const renderRightChart = (data) => {

	const valueData = [],categoryData = [];
	data.forEach((item)=>{
		categoryData.push(
			echarts.format.formatTime('yyyy-MM-dd\nhh:mm:ss', new Date(item.request_begin_time), false)
		);
		valueData.push(item.response_time)
	})
	
	const option = {
		tooltip: {
			trigger: 'axis',
			axisPointer: {
				type: 'shadow'
			}
		},
		grid: {
			bottom: 90
		},
		dataZoom: [
			{
				top: 0,
				id: 'dataZoomX',
				type: 'slider',
				xAxisIndex: [0],
				filterMode: 'filter'
			},
			{
				id: 'dataZoomY',
				type: 'slider',
				yAxisIndex: [0],
				filterMode: 'empty'
			}
		],
		xAxis: {
			data: categoryData,
			silent: false,
			splitLine: {
				show: false
			},
			splitArea: {
				show: false
			}
		},
		yAxis: {
			splitArea: {
				show: false
			}
		},
		series: [
			{
				type: 'bar',
				data: valueData,
				// Set `large` for large data amount
				large: true
			}
		]
	};
	var dom = document.getElementById('right-chart');
	var chart = echarts.init(dom);
	chart.setOption(option);
	chart.on('datazoom', function (params,b) {
		if(params.dataZoomId == 'dataZoomX'){
			// const startVal = Math.floor(categoryData.length * (params.start/100))
			// const endVal = Math.floor(categoryData.length * (params.end/100))
			// startAccessTime.value = categoryData[startVal];
			// endAccessTime.value = categoryData[endVal];
			// if(!loading.value){
			// 	loading.value = true;
			// 	setTimeout(() => {
			// 		current.value = 1;
			// 		searchTable();
			// 	}, 1000);
			// }
		}
	});
}

const startAccessTime = ref();
const endAccessTime = ref();
const timmer = () => {
	setTimeout(()=>{
		const oldEndDate = dayjs(range.value[1]);
		const newEndDate = dayjs(new Date());
		if(newEndDate.diff(oldEndDate)<90000){
			const _temp = [range.value[0],new Date()]
			range.value = _temp;
		}
		timmer()
	},1000);
} 
const search = () => {
	searchTable();
	setTimeout(()=>{
		if(playing.value){
			search();
		}
	},3000);
}
const loading = ref(false);
const searchTable = () => {
	loading.value = false;
	store.commit('account/setClient', route.params?.id);
	pipyProxyService.query({
		id: route.params?.id,
		sql: sqlService.getCount(appendWhere())
	})
		.then(res => {
			total.value = res?.data[0]['count(1)'];
		})
		.catch(err => console.log('Request Failed', err)); 
		
	pipyProxyService.query({
		id: route.params?.id,
		sql: sqlService.getSql({
			where:appendWhere(), 
			sortField:sortField.value, 
			sortOrder: sortOrder?.value,
			pageSize:pageSize.value, 
			current:current.value
		})
	})
		.then(res => {
			
			dataSource.value = res?.data;
			setTimeout(()=>{
				loading.value = false;
			},1000)
		})
		.catch(err => console.log('Request Failed', err)); 
	
}
const searchRightChart = () => {
	if(current.value == 0){
		pipyProxyService.query({
			id: route.params?.id,
			sql: sqlService.getRightSql(appendWhere())
		})
			.then(res => {
				renderRightChart(res?.data);
			})
			.catch(err => console.log('Request Failed', err)); 
	}
}
const searchLeftChart = () => {
	
		pipyProxyService.query({
			id: route.params?.id,
			sql: sqlService.getLeftSql(appendWhere(), groupBy.value.code)
		})
		.then(res => {
			renderLeftChart(res?.data);
		})
		.catch(err => console.log('Request Failed', err)); 
}
const appendWhere = () => {
 
	let where = '';
	if(filters.value){
		const filters_ary = [];
		Object.keys(filters.value).forEach((col) => {
			let filters_str = "";
			if(filters.value[col] != null && col != "global"){
				if(filters.value[col].constraints){
					let cidx = 0;
					filters.value[col].constraints.forEach((constraint,cidx)=>{
						if(constraint.value != null){
							if(cidx > 0){
								filters_str += ` ${filters.value[col].operator} `
							}
							filters_str += appendWhereItem(col, constraint);
							cidx ++;
						}
					})
				} else if(filters.value[col].value != null) {
					filters_str += appendWhereItem(col, filters.value[col])
				}
				if(!!filters_str){
					filters_ary.push(filters_str);
				}
			}
		})
		
		
			if(filters_ary.length > 0){
				where = ' where (' + filters_ary.join(") and (") +")";
			}
	}
	
	if(!!range.value && range.value[0]){
		where += ((where=='')? ' where ': " and ")+` s.request_begin_time > '${dayjs(range.value[0]).format('YYYY-MM-DD HH:mm:ss')}'`;
	}
	if(!!range.value && range.value[1]){
		where += ((where=='')? ' where ': " and ")+` s.request_begin_time < '${dayjs(range.value[1]).format('YYYY-MM-DD HH:mm:ss')}'`;
	}
	return where;
}

const appendWhereItem = (col, filter) => {
	switch (filter.matchMode){
		case FilterMatchMode.STARTS_WITH:
			return ` ${col} like '${filter.value}%' `
		case FilterMatchMode.ENDS_WITH:
			return ` ${col} like '%${filter.value}' `
		case FilterMatchMode.CONTAINS:
			return ` ${col} like '%${filter.value}%' `
		case FilterMatchMode.NOT_CONTAINS:
			return ` ${col} not like '%${filter.value}%' `
		case FilterMatchMode.LESS_THAN:
			return ` ${col} < '${filter.value}' `
		case FilterMatchMode.LESS_THAN_OR_EQUAL_TO:
			return ` ${col} <= '${filter.value}' `
		case FilterMatchMode.GREATER_THAN:
			return ` ${col} > '${filter.value}' `
		case FilterMatchMode.GREATER_THAN_OR_EQUAL_TO:
			return ` ${col} >= '${filter.value}' `
		default:
			return ` ${col} = '${filter.value}' `
	}
}


const initFilters = () => {
    filters.value = {
        global: { value: null, matchMode: FilterMatchMode.CONTAINS },
				protocol: { operator: FilterOperator.OR, constraints: [{ value: null, matchMode: FilterMatchMode.EQUALS }] },
				status: { operator: FilterOperator.OR, constraints: [{ value: null, matchMode: FilterMatchMode.EQUALS }]},
				method: { operator: FilterOperator.OR, constraints: [{ value: null, matchMode: FilterMatchMode.EQUALS }]},
        host: { operator: FilterOperator.OR, constraints: [{ value: null, matchMode: FilterMatchMode.EQUALS }] },
        url: { operator: FilterOperator.OR, constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }] },
        request_size: { value: null, matchMode: FilterMatchMode.GREATER_THAN_OR_EQUAL_TO },
				response_size: { value: null, matchMode: FilterMatchMode.GREATER_THAN_OR_EQUAL_TO },
				response_time: { value: null, matchMode: FilterMatchMode.GREATER_THAN_OR_EQUAL_TO },
        client_ip: { operator: FilterOperator.OR, constraints: [{ value: null, matchMode: FilterMatchMode.EQUALS }] },
				
    //     representative: { value: null, matchMode: FilterMatchMode.IN },
    //     date: { operator: FilterOperator.AND, constraints: [{ value: null, matchMode: FilterMatchMode.DATE_IS }] },
    //     activity: { value: [0, 50], matchMode: FilterMatchMode.BETWEEN },
    };
};

const clearFilter = () => {
    initFilters();
};

const searchPage = (e)=>{
	if(e){
		current.value = e.first;
		pageSize.value = e.rows;
		searchTable();
	}
}
const searchSort = (e)=>{
	if(e){
		sortField.value = e.sortField;
		sortOrder.value = e.sortOrder;
		current.value = 0
		searchTable();
	}
}
const openChart = () => {
	visibleRight.value = true;
	searchLeftChart();
	searchRightChart();
}
const play = () => {
	playing.value = !playing.value;
	if(!!playing.value){
		search();
	}
}
const parseJson = (str,stringify) => {
	let rtn = null;
	try {
		const _json = !!str?JSON.parse(str):{};
		rtn = stringify?JSON.stringify(_json,null,'\t'):_json;
	} catch(e){
		rtn = !!str?str:(stringify?'':{})
	}
	return rtn
}
const colorAry = ['#239EF0','#FAA419','#EE5879','green','#239EF0','#FAA419','#EE5879','green'];
const timingGroup = ref({
	list:[],
	total:0,
	width: '100%'
});
const sizeGroup = ref({
	list:[],
	total:0,
	width: '100%'
});
const rowClick = (row) => {
	if(row.data?.id){
		pipyProxyService.query({
			id: route.params?.id,
			sql: sqlService.getDetailSql(row.data?.connection_id,row.data?.id)
		})
			.then(res => {
				selectRowData.value = { session:row.data, reuqest:{}, response:[]};
				timingGroup.value = {
					list:[],
					total:0,
					width: '100%'
				};
				sizeGroup.value = {
					list:[],
					total:0,
					unit:'B',
					width: '100%'
				};
				(res?.data || []).forEach((message,idx) => {
					message.head_json = parseJson(message.head);
					message.tail_json = parseJson(message.tail);
					message.body_json = parseJson(message.body,true);
					const _diff = diff(message.end_time, message.begin_time);
					sizeGroup.value.total += message.tail_json.headSize;
					sizeGroup.value.list.push({
						color: colorAry[idx],
						label: (message.direction == 0?'Request':'Response') + ' head',
						val: message.tail_json.headSize,
					})
					sizeGroup.value.total += message.tail_json.bodySize;
					sizeGroup.value.list.push({
						color: colorAry[idx],
						label: (message.direction == 0?'Request':'Response') + ' body',
						val: message.tail_json.bodySize,
					})
					timingGroup.value.total += _diff*1;
					timingGroup.value.list.push({
						color: colorAry[idx],
						label: message.direction == 0?'Request':'Response',
						val: _diff
					})
					if(message.direction == 0){
						selectRowData.value.request = message;
					} else if(message.direction == 1){
						selectRowData.value.response.push(message);
					} 
				});
				sizeGroup.value.list.forEach((group) => {
					group.value = Math.floor(group.val*100/sizeGroup.value.total);
				})
				sizeGroup.value.width = `${minToMax(sizeGroup.value.total,1000000,40)}%`
				timingGroup.value.list.forEach((group) => {
					group.value = Math.floor(group.val*100/timingGroup.value.total);
				})
				timingGroup.value.width = `${minToMax(timingGroup.value.total,5000,30)}%`;
				
				timingGroup.value.list.forEach((group) => {
					group.val = getTimeUnit(group.val);
				});
				timingGroup.value.total = getTimeUnit(timingGroup.value.total);
				sizeGroup.value.list.forEach((group) => {
					group.val = getBitUnit(group.val);
				});
				sizeGroup.value.total = getBitUnit(sizeGroup.value.total);
				
				visibleBottom.value = true;
			})
			.catch(err => console.log('Request Failed', err)); 
	}
}
const minToMax = (total, max, min) => {
	const per = (total*100/max).toFixed(1);
	if(per<10){
		return min;
	} else if(per>100){
		return 100;
	} else {
		return per;
	}
}
const diff = (end, begin) => {
	
	const beginD = dayjs(begin);
	const endD = dayjs(end);
	return (endD.diff(beginD,'millisecond'));
}
async function copyCode(event,code) {
    await navigator.clipboard.writeText(code);
    event.preventDefault();
}
watch(filters,()=>{
	current.value = 0
	searchTable();
},{
	deep: true
});
onBeforeMount(() => {
    initFilters();
});
onMounted(() => {
	searchTable();
	timmer();
})

</script>

<template>
    <div>
				<div v-if="route.params?.id" style="padding-bottom: 0;">
					<Breadcrumb :home="home" :model="[{label:route.params?.id}]" />
				</div>
        <div >
					<Card class="nopd">
						<template #content>
                <DataTable
									showGridlines
									v-model:selection="selected" 
									selectionMode="single" 
									:metaKeySelection="metaKey" 
									@sort="searchSort"
									size="small"
									@filter="searchFilter"
									:value="dataSource"
									v-model:sortField="sortField"
									v-model:sortOrder="sortOrder"
									dataKey="id"
									:rowHover="true"
									@row-click="rowClick"
									v-model:filters="filters"
									resizableColumns
									filterDisplay="menu"
									:loading="loading"
									responsiveLayout="scroll"
									:globalFilterFields="['protocol', 'status', 'host', 'url', 'request_size', 'response_size', 'response_time', 'client_ip']"
                >
                    <template #header>
                        <div class="flex justify-content-between flex-column sm:flex-row">
													<Paginator 
														:rowsPerPageOptions="[10, 20, 50]"
														@page="searchPage"
														:totalRecords="total"
														v-model:first="current"
														v-model:rows="pageSize"
														currentPageReportTemplate="{first} to {last} of {totalRecords}"
													></Paginator>
													<div class="flex" style="position: relative;left: 1px;">
														<Button @click="openChart()" size="small" type="button" icon="pi pi-chart-pie" label="Analysis" />
														<Button @click="play" :severity="playing?'info':'success'" size="small" type="button" :icon="playing?'pi pi-spinner pi-spin':'pi pi-play'" />
														<Button severity="danger" size="small" type="button" icon="pi pi-filter-slash"  class="" @click="clearFilter()" />
														<Button severity="primary" size="small" type="button" icon="pi pi-clock" class="calendar-icon p-button-outlined"/>
														<Calendar @hide="search()" style="width: 290px;" v-model="range" showTime hourFormat="24" selectionMode="range" :manualInput="true" />
																<!-- <InputText v-model="filters['global'].value" placeholder="Keyword Search" style="width: 100%" /> -->
													</div>
													
													
                        </div>
                    </template>
                    <template #empty> No customers found. </template>
										<Column :showFilterOperator="false" :showFilterMatchModes="false"   field="protocol" header="Protocol" style="min-width: 3rem">
												<template #body="{ data }">
													<Tag :severity="data.protocol == 'https'?'success':'info'" :value="data.protocol"></Tag>
												</template>
												<template #filter="{ filterModel }">
													<Dropdown v-model="filterModel.value" :options="protocols" placeholder="Any" class="p-column-filter" :showClear="true">
													    <template #value="slotProps">
													        <span :class="'customer-badge status-' + slotProps.value" v-if="slotProps.value">{{ slotProps.value }}</span>
													        <span v-else>{{ slotProps.placeholder }}</span>
													    </template>
													    <template #option="slotProps">
													        <span :class="'customer-badge status-' + slotProps.option">{{ slotProps.option }}</span>
													    </template>
													</Dropdown>
												</template>
										</Column>
										<Column sortable field="status" header="Status" style="min-width: 3rem">
												<template #body="{ data }">
														<Tag v-if="data && data.status>0" :severity="['','','success','warning','danger','danger'][(data.status+'').substr(0,1)]" :value="data.status"></Tag>
												</template>
												<template #filter="{ filterModel }">
														<InputText type="text" v-model="filterModel.value" class="p-column-filter" placeholder="Search" />
												</template>
										</Column>
										<Column sortable field="host" header="Host" style="min-width: 12rem">
												<template #body="{ data }">
													{{data.host}}
												</template>
												<template #filter="{ filterModel }">
														<InputText type="text" v-model="filterModel.value" class="p-column-filter" placeholder="Search" />
												</template>
										</Column>
										<Column sortable field="url" header="Url" style="min-width: 16rem;max-width: 24rem;word-break: break-all;">
												<template #body="{ data }">
													{{data.url}}
												</template>
												<template #filter="{ filterModel }">
														<InputText type="text" v-model="filterModel.value" class="p-column-filter" placeholder="Search" />
												</template>
										</Column>
										<Column :showFilterOperator="false" :showFilterMatchModes="false"   field="method" header="Method" style="min-width: 3rem">
												<template #body="{ data }">
													<Tag :severity="{DELETE:'danger',GET:'',POST:'warning',PUT:'info'}[data.method]" :value="data.method"></Tag>
												</template>
												<template #filter="{ filterModel }">
													<Dropdown v-model="filterModel.value" :options="['GET','POST','DELETE','PUT']" placeholder="Any" class="p-column-filter" :showClear="true">
													    <template #value="slotProps">
													        <span :class="'customer-badge status-' + slotProps.value" v-if="slotProps.value">{{ slotProps.value }}</span>
													        <span v-else>{{ slotProps.placeholder }}</span>
													    </template>
													    <template #option="slotProps">
													        <span :class="'customer-badge status-' + slotProps.option">{{ slotProps.option }}</span>
													    </template>
													</Dropdown>
												</template>
										</Column>
										<Column sortable field="request_begin_time" header="Request Time" style="min-width: 6rem">
												<template #body="{ data }">
													{{data.request_begin_time}}
												</template>
										</Column>
										<Column :filterMatchModeOptions="[
											{ label: 'Greater Than', value: 'gte' },
											{ label: 'Less Than', value: 'lte' },
										]"  sortable field="s.request_size" header="Request Size" style="min-width: 5rem">
												<template #body="{ data }">
													<b>{{getBitUnit(data.request_size)}}</b>
												</template>
												<template #filter="{ filterModel }">
														<InputText type="text" v-model="filterModel.value" class="p-column-filter" placeholder="Search" />
												</template>
										</Column>
										<Column :filterMatchModeOptions="[
											{ label: 'Greater Than', value: 'gte' },
											{ label: 'Less Than', value: 'lte' },
										]"  sortable field="response_time" header="Response Time" style="min-width: 6rem">
												<template #body="{ data }">
													{{data.response_time}}ms
												</template>
												<template #filter="{ filterModel }">
														<InputText type="text" v-model="filterModel.value" class="p-column-filter" placeholder="Search" />
												</template>
										</Column>
										<Column :filterMatchModeOptions="[
											{ label: 'Greater Than', value: 'gte' },
											{ label: 'Less Than', value: 'lte' },
										]" sortable field="response_size" header="Response Size" style="min-width: 5rem">
												<template #body="{ data }">
													<b>{{getBitUnit(data.response_size)}}</b>
												</template>
												<template #filter="{ filterModel }">
														<InputText type="text" v-model="filterModel.value" class="p-column-filter" placeholder="Search" />
												</template>
										</Column>
										<Column sortable field="client_ip" header="Client IP" style="min-width: 10rem">
												<template #body="{ data }">
													{{data.client_ip}}
												</template>
												<template #filter="{ filterModel }">
														<InputText type="text" v-model="filterModel.value" class="p-column-filter" placeholder="Search" />
												</template>
										</Column>
                </DataTable>
						</template>
					</Card>
        </div>
    </div>

		<Sidebar class="noheader"  style="height: 80%;" v-model:visible="visibleBottom"  position="bottom">
			<TabView>
			    <TabPanel>
							<template #header>
								<i class="pi pi-chart-bar mr-2"/>
								Overview
							</template>
			        <Accordion :multiple="true" :activeIndex="[0,1,2]">
			            <AccordionTab v-if="selectRowData.request" :header="`Timings (${ timingGroup.total })`">
										<ul class="list-none p-0 m-0">
											<li class="flex align-items-center py-3 px-5 surface-border flex-wrap">
													<div class="text-500 w-6 md:w-2 font-medium" style="word-break: break-all;padding-right: 15px;">{{selectRowData.request?.head_json?.path}}</div>
													<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
														<MeterGroup :style="{width:timingGroup.width}" :value="timingGroup.list" >
															<template #label="{ value }">
																	<div class="flex text-sm gap-2">
																			<template v-for="(val, i) of value" :key="i">
																					<span :style="{ color: val.color }" class="flex gap-2">
																							{{ val.label }} ({{ val.val }})
																					</span>
																			</template>
																	</div>
															</template>
															<template #start="{ totalPercent }">
																	<div class="flex justify-content-between mt-3 mb-2">
																			<span></span>
																			<span>{{ timingGroup.total }}</span>
																	</div>
															</template>
														</MeterGroup>
													</div>
											</li>
										</ul>
			            </AccordionTab>
									<AccordionTab v-if="selectRowData.request" :header="`Size (${ sizeGroup.total })`">
										<ul class="list-none p-0 m-0">
											<li class="flex align-items-center py-3 px-5 surface-border flex-wrap">
													<div class="text-500 w-6 md:w-2 font-medium" style="word-break: break-all;padding-right: 15px;">{{selectRowData.request?.head_json?.path}}</div>
													<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
														<MeterGroup :style="{width:sizeGroup.width}" :value="sizeGroup.list" >
															<template #label="{ value }">
																	<div class="flex text-sm gap-2">
																			<template v-for="(val, i) of value" :key="i">
																					<span :style="{ color: val.color }" class="flex gap-2">
																							{{ val.label }} ({{ val.val }})
																					</span>
																			</template>
																	</div>
															</template>
															<template #start="{ totalPercent }">
																	<div class="flex justify-content-between mt-3 mb-2">
																			<span></span>
																			<span>{{ sizeGroup.total }}</span>
																	</div>
															</template>
														</MeterGroup>
													</div>
											</li>
										</ul>
									</AccordionTab>
			            <AccordionTab header="Basic">
										<ul class="list-none p-0 m-0" v-if="selectRowData.session">
											<li class="flex align-items-center py-3 px-5 surface-border flex-wrap">
													<div class="text-500 w-6 md:w-2 font-medium">Url</div>
													<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">{{selectRowData.session.url}}</div>
											</li>
											<li class="flex align-items-center py-3 px-5 border-top-1 surface-border flex-wrap">
													<div class="text-500 w-6 md:w-2 font-medium">Status</div>
													<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">
														<Tag v-if="selectRowData.session.status>0" :severity="['','','success','warning','danger','danger'][(selectRowData.session.status+'').substr(0,1)]" :value="selectRowData.session.status"></Tag>
													</div>
											</li>
											<li class="flex align-items-center py-3 px-5 border-top-1 surface-border flex-wrap">
													<div class="text-500 w-6 md:w-2 font-medium">Client Ip</div>
													<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1">{{selectRowData.session.client_ip}}</div>
											</li>
										</ul>
			            </AccordionTab>
			        </Accordion>
			    </TabPanel>
			    <TabPanel>
							<template #header>
								<i class="pi pi-eye mr-2"/>
								Inspectors
							</template>
							<Splitter style="height: 100%" >
							    <SplitterPanel class="flex">
										<Accordion class="w-full " :multiple="true" :activeIndex="[0]">
											<AccordionTab header="Request" :key="0">
												<ul class="list-none p-0 m-0" v-if="selectRowData.request?.head_json">
													<li class="border-bottom-1 flex align-items-center py-3 px-5  surface-border flex-wrap">
															<div class="text-500 w-6 md:w-2 font-medium">path</div>
															<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1" >
																<Tag v-if="selectRowData.request.head_json?.method" class="mr-2" severity="success">{{selectRowData.request.head_json?.method}}</Tag>
																{{selectRowData.request.head_json?.path}}
															</div>
													</li>
													<li class="border-bottom-1 flex align-items-center py-3 px-5  surface-border flex-wrap">
															<div class="text-500 w-6 md:w-2 font-medium">protocol</div>
															<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1" >
																<Tag>{{selectRowData.request.head_json?.protocol}}</Tag>
															</div>
													</li>
												</ul>
												<TabView class="nopd" v-if="selectRowData.request">
													<TabPanel header="Headers">
														<ul class="list-none p-0 m-0">
															<li v-for="(key,index) in Object.keys(selectRowData.request.head_json?.headers)" :class="index>0?'border-top-1':''" class="flex align-items-center py-3 px-5  surface-border flex-wrap">
																	<div class="text-500 w-6 md:w-2 font-medium">{{key}}</div>
																	<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1" style="word-break: break-all;">{{selectRowData.request.head_json?.headers[key]}}</div>
															</li>
														</ul>
													</TabPanel>
													<TabPanel  header="Payload">
														<Button class="code-action-copy" icon="pi pi-copy" text @click="copyCode($event,selectRowData.request.body_json)" v-tooltip.focus="{ value: 'Copied to clipboard' }"/>
														<pre class="app-code"><code>{{selectRowData.request.body_json}}</code></pre>
													</TabPanel>
												</TabView>
											</AccordionTab>
										</Accordion>
									</SplitterPanel>
							    <SplitterPanel class="flex">
										<Accordion class="w-full" :multiple="true" :activeIndex="[0]">
											<AccordionTab class="mb-2" :header="`Response | ${response.end_time}`" v-for="(response,responseidx) in (selectRowData.response)" :key="responseidx">
												<ul class="list-none p-0 m-0" v-if="response?.head_json">
													
													<li class="border-bottom-1 flex align-items-center py-3 px-5  surface-border flex-wrap">
															<div class="text-500 w-6 md:w-2 font-medium">status</div>
															<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1" >
																<Tag v-if="response.head_json?.status>0" :severity="['','','success','warning','danger','danger'][(response.head_json?.status+'').substr(0,1)]" :value="response.head_json?.status"></Tag>
															</div>
													</li>
													<li class="border-bottom-1 flex align-items-center py-3 px-5  surface-border flex-wrap">
															<div class="text-500 w-6 md:w-2 font-medium">protocol</div>
															<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1" >
																<Tag>{{response.head_json?.protocol}}</Tag>
															</div>
													</li>
												</ul>
												<TabView class="nopd">
													<TabPanel header="Headers">
														<ul class="list-none p-0 m-0">
															<li v-for="(key,index) in Object.keys(response.head_json?.headers)" :class="index>0?'border-top-1':''" class="flex align-items-center py-3 px-5  surface-border flex-wrap">
																	<div class="text-500 w-6 md:w-2 font-medium">{{key}}</div>
																	<div class="text-900 w-full md:w-8 md:flex-order-0 flex-order-1"  style="word-break: break-all;">{{response.head_json?.headers[key]}}</div>
															</li>
														</ul>
													</TabPanel>
													<TabPanel header="Body">
														<Button class="code-action-copy" icon="pi pi-copy" text @click="copyCode($event,response.body_json)" v-tooltip.focus="{ value: 'Copied to clipboard' }"/>
														<pre class="app-code"><code>{{response.body_json}}</code></pre>
													</TabPanel>
												</TabView>
											</AccordionTab>
										</Accordion>
									</SplitterPanel>
							</Splitter>
					</TabPanel>
			</TabView>
			
		</Sidebar>
		<Sidebar class="noheader nocontentpd" :showCloseIcon="false"  style="width: 50%;min-width: 300px;" v-model:visible="visibleRight" position="right">
			<div class="grid mt-2">
				<div class="col-12" style="padding-bottom: 0;">
					<Card >
						<template #content>
							<div style="width: 100%;height: 340px;position: relative;top: 20px;" id="right-chart"></div>
						</template>
					</Card>
				</div>
				<div class="col-12">
					<Card>
						<template #title>
							<Dropdown @change="searchLeftChart()" v-model="groupBy" :options="groupByOptions" optionLabel="name" placeholder="Select" />
						</template>
						<template #content>
							<div style="width: 100%;height: 310px;" id="left-chart"></div>
						</template>
					</Card>
				</div>
			</div>
		</Sidebar>
</template>

<style scoped lang="scss">
::v-deep(.p-datatable-frozen-tbody) {
    font-weight: bold;
}

::v-deep(.p-datatable-scrollable .p-frozen-column) {
    font-weight: bold;
}
::v-deep(.p-breadcrumb){
	border-radius: 0;
	border-left: none;
	border-right: none;
}
::v-deep(.p-tabview-panels){
	padding-left: 0;
	padding-right: 0;
}
::v-deep(.p-accordion-content){
	padding: 0;
}
.block-action-copy {
		i {
				color: var(--primary-color);
				font-size: 1.25rem;
		}
}
.code-action-copy{
	position: absolute;
	right: 0;
}
.app-code{
	width: 100%;
}
</style>
