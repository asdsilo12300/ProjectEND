import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')

  if (mode === 'production' && !env.VITE_API_BASE_URL?.trim()) {
    throw new Error('VITE_API_BASE_URL must be set to the public Laravel API URL before deploying.')
  }

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/storage': 'http://localhost:8000',
      },
    },
  }
})
