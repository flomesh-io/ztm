import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons';

const mobile = !!/android|ios/.exec(process.env.TAURI_ENV_PLATFORM);
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async (config) => {
	return {
		clearScreen: false,
		optimizeDeps: {
			dynamicImportVars: true,
		},
		server: {
			port: 1420,
			strictPort: true,
			host: host || false,
			hmr: mobile
				? {
						protocol: "ws",
						host: host,
						port: 1421,
					}
				: undefined,
			watch: {
				// 3. tell vite to ignore watching `src-tauri`
				ignored: ["**/src-tauri/**"],
			},
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
				iconDirs: [resolve(process.cwd(), './src/assets/svg')],
				symbolId: 'svg-[name]',
			}),
		],
		resolve: {
			alias: {
				'@': fileURLToPath(new URL('./src', import.meta.url))
			}
		}
	}
});
