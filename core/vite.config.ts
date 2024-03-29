import { defineConfig, splitVendorChunkPlugin } from 'vite'
//import { viteSingleFile } from "vite-plugin-singlefile"
//import { terser } from 'rollup-plugin-terser'
//import { visualizer } from "rollup-plugin-visualizer" 

export default defineConfig({
  plugins: [splitVendorChunkPlugin()],
  build: {
    chunkSizeWarningLimit: 50000,
    rollupOptions: {
      plugins: [
        //terser({ format: { comments: false } }),
      ],
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