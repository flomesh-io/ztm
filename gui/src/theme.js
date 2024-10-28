import { definePreset } from '@primevue/themes';
import Aura from '@primevue/themes/aura';
const MyPreset = definePreset(Aura, {
    //Your customizations, see the following sections for examples
		//#f9fafb
		semantic: {
			//--stepper-marker-active-background);
			//@media (prefers-color-scheme: dark)
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
			colorScheme:{
				light: {
					"card-shadow":"0px 4px 30px rgba(221, 224, 255, .54)",
					"primary-color-text": "#ffffff",
					surface: {
						section: "#ffffff",
						border: '#ececec',
						card: "#ffffff",
						ground: "#f3f6f7",
						subground: "#f7fafb",
						hoverground: "#eaf1f2",
						html: "#ffffff",
						tip: "{gray.600}"
					}
				},
				dark: {
					"primary-color": "{primary.600}",
					"bg-primary-100": "var(--primary-300) !important",
					"card-shadow":"0px 4px 30px rgba(0, 0, 0, .84)",
					"primary-inverse-color": "#ffffff",
					"primary-color-text": "#ffffff",
					surface: {
						section: "{gray-800}",
						border: '{gray-700}',
						ground: "#222222",
						subground: "#191919",
						hoverground: "#333333",
						card: "{gray-900}",
						html: "#18181B",
						tip: "{gray.400}"
					},
					gray: {
						900: "#111111",
						800: "#222222"
					}
				}
			}
		}
});

export default MyPreset;