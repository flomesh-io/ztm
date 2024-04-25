import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { internalIpV4 } from "internal-ip";
const mobile = !!/android|ios/.exec(process.env.TAURI_ENV_PLATFORM);
//target: process.env.TAURI_PLATFORM == "windows" ? "chrome105" : "safari13",
export default defineConfig(async (config) => ({
  clearScreen: false,
  optimizeDeps: {
    dynamicImportVars: true,
  },
  server: {
    port: 1420,
    strictPort: true,
    host: mobile ? "0.0.0.0" : false,
    hmr: mobile
      ? {
          protocol: "ws",
          host: await internalIpV4(),
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
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
}));
