import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons';
export default defineConfig(async (config) => {
	return {
		base:"./",
		clearScreen: false,
		optimizeDeps: {
			dynamicImportVars: true,
		},
		server: {
			port: 1422,
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
			createSvgIconsPlugin({
				iconDirs: [resolve(process.cwd(), '../../../src/assets/svg')],
				symbolId: 'svg-[name]', // 自定义 symbolId 模板
			}),
		],
		resolve: {
			alias: {
				'@': fileURLToPath(new URL('../../../src', import.meta.url))
			}
		}
	}
});
