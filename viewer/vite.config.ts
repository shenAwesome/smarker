import { defineConfig } from 'vite'
import { splitVendorChunkPlugin } from 'vite'
//import { viteSingleFile } from "vite-plugin-singlefile"
//import { terser } from 'rollup-plugin-terser'
//import { visualizer } from "rollup-plugin-visualizer" 
import { viteSingleFile } from "vite-plugin-singlefile"

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    chunkSizeWarningLimit: 50000
  },
  base: '',
  server: {
    port: 4000, open: true,
    hmr: {}, proxy: {}
  }
})