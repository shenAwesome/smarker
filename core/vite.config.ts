import { defineConfig } from 'vite'
import { splitVendorChunkPlugin } from 'vite'
//import { visualizer } from "rollup-plugin-visualizer" 

export default defineConfig({
  plugins: [splitVendorChunkPlugin()],
  build: {
    chunkSizeWarningLimit: 50000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            return 'vendors'
          }
        }
      }
    }
  },
  base: '',
  server: {
    port: 4000, open: true,
    hmr: {}, proxy: {}
  }
})