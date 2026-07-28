import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/admin': 'http://localhost:8000',
      '/knowledge-base': 'http://localhost:8000',
      '/chat': 'http://localhost:8000',
      '/tickets': 'http://localhost:8000',
      '/conversations': 'http://localhost:8000',
      '/audio': 'http://localhost:8000',
    },
  },
})
