import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared/contract': path.resolve(__dirname, '../shared/contract/index.ts'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  optimizeDeps: {
    include: ['recharts'],
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
