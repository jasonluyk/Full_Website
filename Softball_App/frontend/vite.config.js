import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/softball/',
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/softball/api': {
        target: 'http://localhost:9000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/softball/, '')
      }
    }
  }
})