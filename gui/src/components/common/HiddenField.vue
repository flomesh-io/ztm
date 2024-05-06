<script setup>
import { ref, watch, computed } from "vue";
const props = defineProps(["name","rules","value"]);
const val = ref(props.value)
watch(() => props.value,() => {
	val.value = props.value;
})
</script>
<template>
		<Field :name="props.name" v-model="val" :rules="rules" :validateOnBlur="true" v-slot="{ field, errorMessage }">
			<slot name="default" :field="field"/>
			<div v-if="errorMessage" class="text-red-500 text-sm">{{errorMessage}}</div>
		</Field>
</template>
