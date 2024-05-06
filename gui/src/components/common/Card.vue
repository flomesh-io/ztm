<template>
    <div class="p-card" :class="class" >
        <div v-if="$slots.feature" class="p-card-feature" >
            <slot name="feature"></slot>
        </div>
        <div v-if="$slots.title || $slots.subtitle || $slots.action" class="p-card-header" >
						<div class="flex ">
							<div v-if="$slots.title || $slots.subtitle" class="p-card-caption flex-item">
									<div v-if="$slots.title" class="p-card-title" >
											<slot name="title"></slot>
									</div>
									<div v-if="$slots.subtitle" class="p-card-subtitle" >
											<slot name="subtitle"></slot>
									</div>
							</div>
							<div v-if="$slots.action" class="text-right">
								<slot name="action"></slot>
							</div>
						</div>
        </div>
        <div class="p-card-body" >
            <div class="p-card-content" >
                <slot name="content"></slot>
            </div>
            <div v-if="$slots.footer" :class="p-card-footer" >
                <slot name="footer"></slot>
            </div>
        </div>
    </div>
</template>

<script>
import BaseCard from './BaseCard.vue';

export default {
	name: 'Card',
	extends: BaseCard,
	inheritAttrs: false,
	props: ['class'],
};
</script>

<style lang="scss" scoped>
	:deep(.p-card-header){
		padding: 1.0rem 1.5rem;
	}
	:deep(.p-card-body){
		padding: 0rem !important;
	}
</style>