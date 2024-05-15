<script setup>
import { useLayout } from '@/layout/composables/layout';
import { computed } from 'vue';

const { layoutConfig } = useLayout();
import XeyeSvg from "@/assets/img/logo.png";
</script>

<template>
    <div class="layout-footer">
				<img class="mr-1" :src="XeyeSvg"  height="20"/>
        ZTM by
        <a target="_blank" href="https://flomesh.io/pipy" class="font-medium ml-2">Pipy proxy</a>
    </div>
</template>
<style lang="scss" scoped></style>
