import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
// import monacoEditorPlugin from 'vite-plugin-monaco-editor';
import { resolve } from 'path';

import fs from 'fs';
import path from 'path';

// 用于生成脚本列表的函数
async function generateScriptList() {
  const scriptsDir = path.join(__dirname, 'public/scripts');
  const files = await fs.promises.readdir(scriptsDir);
  const scriptFiles = files.filter(file => file.endsWith('.js'));

  const outputPath = path.join(__dirname, 'public/scriptList.json');
  await fs.promises.writeFile(outputPath, JSON.stringify({ files: scriptFiles }, null, 2));
}
export default defineConfig(async (config) => {
	return {
		base:"./",
		clearScreen: false,
		optimizeDeps: {
			dynamicImportVars: true,
		},
		server: {
			port: 1423,
			strictPort: true,
			proxy: {
				'/api': {
					target: `http://0.0.0.0:${loadEnv(config.mode, process.cwd()).VITE_APP_API_PORT}/`,
					changeOrigin: true,
				},
			}
		},
		plugins: [
			generateScriptList(),
			vue({reactivityTransform: true})
		],
		resolve: {
			alias: {
				'@': fileURLToPath(new URL('../../../src', import.meta.url))
			}
		}
	}
});
