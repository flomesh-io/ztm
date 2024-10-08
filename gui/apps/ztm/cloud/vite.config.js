import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
export default defineConfig(async (config) => {
	return {
		base:"./",
		clearScreen: false,
		optimizeDeps: {
			dynamicImportVars: true,
		},
		server: {
			port: 1425,
			strictPort: true,
			proxy: {
				'/api': {
					target: `http://0.0.0.0:${loadEnv(config.mode, process.cwd()).VITE_APP_API_PORT}/`,
					changeOrigin: true,
				},
			}
		},
		plugins: [
			vue({reactivityTransform: true}),
		],
		resolve: {
			alias: {
				'@': fileURLToPath(new URL('../../../src', import.meta.url))
			}
		}
	}
});
