import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    minify: false,
    rollupOptions: {
      input: {
        background: path.resolve(__dirname, 'src/background/index.js'),
        content: path.resolve(__dirname, 'src/content/overlay.js'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    }
  },
  server: {
    port: 5175,
    strictPort: false,
  }
})
