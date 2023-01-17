import { defineConfig } from 'vite'
import { splitVendorChunkPlugin } from 'vite'
//import { visualizer } from "rollup-plugin-visualizer" 

export default defineConfig({
  plugins: [splitVendorChunkPlugin()],
  base: '',
  server: {
    port: 4000, open: true,
    hmr: {}, proxy: {}
  }
})