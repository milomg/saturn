import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'

// @ts-ignore (not sure why typescript is having trouble with this import)
import { lezer } from '@lezer/generator/rollup'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), wasm(), topLevelAwait(), lezer()],

  worker: {
    plugins: () => [wasm(), topLevelAwait()],
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  // prevent vite from obscuring rust errors
  clearScreen: false,
  // tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
  },
  // to make use of `TAURI_DEBUG` and other env variables
  // https://tauri.studio/v1/api/config#buildconfig.beforedevcommand
  envPrefix: ['VITE_'],
  build: {
    // Tauri supports es2021
    target: ['es2021', 'chrome100', 'safari13'],
    // don't minify for debug builds
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    // produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_DEBUG,
    rollupOptions: {
      output: {
        manualChunks: {
          codemirror: [
            '@codemirror/autocomplete',
            '@codemirror/lint',
            '@codemirror/state',
            '@codemirror/view',
            '@codemirror/language',
            '@lezer/highlight',
            '@lezer/lr',
            '@replit/codemirror-minimap',
            '@replit/codemirror-vim',
          ],
        },
      },
    },
  },

  // for some reason esbuild is running in the worker before the top level await plugin... we ignore the warning that it generates
  esbuild: {
    supported: {
      'top-level-await': true,
    },
  },
})
