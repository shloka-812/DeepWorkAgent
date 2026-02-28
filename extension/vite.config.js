import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    minify: 'terser',
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, 'popup.html'),
        background: path.resolve(__dirname, 'src/background/index.js'),
        content: path.resolve(__dirname, 'src/content/overlay.js'),
      },
      output: [
        {
          dir: 'dist',
          format: 'iife',
          entryFileNames: '[name].js',
          chunkFileNames: '[name].js',
        }
      ]
    }
  },
  server: {
    port: 5175,
    strictPort: false,
  }
})
