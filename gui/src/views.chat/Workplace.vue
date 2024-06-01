<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useStore } from 'vuex';
const store = useStore();
const router = useRouter();

const apps = ref([
    { label: 'Services',route: '/mesh/services', color1: '#c084fc', color2: '#fbbf24', icon: 'pi pi-server' },
    { label: 'Ports', route: '/mesh/ports', color1: '#fbbf24', color2: '#60a5fa', icon: 'pi pi-bullseye' },
    { label: 'Logs', route: '/mesh/log', color1: '#60a5fa', color2: '#c084fc', icon: 'pi pi-book' },
]);
const go = (path) => {
	router.push(path);
}
</script>

<template>
    
	<AppHeader :main="true">
			<template #center>
				<b>Workplace</b>
			</template>
	
			<template #end> 
			</template>
	</AppHeader>
	<div class="grid mt-3 text-left px-5" >
		<div class="col-6 md:col-4 lg:col-3" v-for="app of apps" :key="app.label">
			<div class="surface-card shadow-2 p-3 border-round pointer" @click="go(app.route)">
				<div class="flex" >
						<span class="text-center " 
						style="border-radius: 6px;height: 40px;line-height: 40px;width: 40px;"
						:style="{ backgroundColor: `${app.color1}`, color: '#ffffff' }">
								<i class="text-2xl relative" style="top:5px" :class="app.icon" />
						</span>
						<div class="gap-1 pl-3" style="flex: 1;line-height: 40px;">
								<span class="text-surface-500 dark:text-surface-400 text-sm text-xl">{{ app.label }}</span>
						</div>
				</div>
			</div>
		</div>
	</div>
</template>
