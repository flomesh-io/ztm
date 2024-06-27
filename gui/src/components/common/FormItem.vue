<script setup>
import { ref, computed } from "vue";
const props = defineProps(['label','border']);
const windowWidth = computed(() =>  window.innerWidth);
const isMobile = computed(() => windowWidth.value<=768);
</script>
<template>
    <li class="flex align-items-center py-3 px-2 surface-border flex-wrap" :class="{'border-bottom-1':props.border!=false}">
    		<div class="text-tip font-medium text-right pr-4 pl-2" :class="{'w-3':isMobile,'w-3':!isMobile}">{{props.label}}</div>
    		<div class="text-900 md:flex-order-0 flex-order-1 text-left" :class="{'w-7':isMobile,'w-7':!isMobile}">
					<slot/>
    		</div>
    </li>
</template>