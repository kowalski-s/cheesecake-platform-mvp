import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  server: { port: 5175, strictPort: true },
  plugins: [
    react(),
    {
      name: 'startup-logger',
      configureServer(server) {
        server.httpServer?.on('listening', () => {
          const cwd = process.cwd()
          const hasLocal = fs.existsSync(path.resolve(cwd, '.env.local'))
          const hasEnv = fs.existsSync(path.resolve(cwd, '.env'))
          const envFile = hasLocal ? '.env.local' : (hasEnv ? '.env' : 'none')
          console.log(`[Netlify Dev] Env loaded from: ${envFile}`)
          console.log('[Netlify Dev] Health: http://localhost:8888/.netlify/functions/health')
          console.log('[Netlify Dev] If 8888 is busy, switch to 9999 in netlify.toml and re-run.')
        })
      },
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
