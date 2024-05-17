import { definePreset } from 'primevue/themes';
import Aura from 'primevue/themes/aura';
const MyPreset = definePreset(Aura, {
    //Your customizations, see the following sections for examples
		semantic: {
			//--stepper-marker-active-background);
			surface: {
				border: '#ececec',
			},
			danger: '{red.500}',
			primary: {
					50: '#fbf7ff',
					100: '#dad6fd',
					200: '#cab6fc',
					300: '#b996fa',
					400: '#a975f9',
					500: '#9855f7',
					600: '#7f48d2',
					700: '#663cad',
					800: '#4c2f88',
					900: '#332263',
					950: '{indigo.950}'
			},
			green: {
					50: '{emerald.50}',
					100: '{emerald.100}',
					200: '{emerald.200}',
					300: '{emerald.300}',
					400: '{emerald.400}',
					500: '{emerald.500}',
					600: '{emerald.600}',
					700: '{emerald.700}',
					800: '{emerald.800}',
					900: '{emerald.900}',
					950: '{emerald.950}'
			},
			border: {
				radius: '6px',
			},
			rounded: {
				sm: '6px',
				base: '6px',
				md: '8px',
				lg: '8px',
				xl: '12px'
			},
		}
});

export default MyPreset;