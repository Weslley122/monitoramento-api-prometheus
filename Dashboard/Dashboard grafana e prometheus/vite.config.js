import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Endereço do Prometheus; troque com PROMETHEUS_URL no ambiente ou num arquivo .env.local.
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.PROMETHEUS_URL || 'http://localhost:9090'

  // O app chama /prometheus/api/v1/...; o Vite repassa para o Prometheus (sem CORS).
  const proxy = {
    '/prometheus': {
      target,
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/prometheus/, ''),
    },
  }

  return {
    plugins: [react()],
    server: { proxy },
    preview: { proxy },
  }
})
