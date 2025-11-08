#!/usr/bin/env node
// Checks port conflicts for Vite (5175) and Netlify Dev (8888)
// Prints Windows-friendly guidance for resolving conflicts.

import net from 'node:net'
import fs from 'node:fs'
import path from 'node:path'

function checkPort(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve({ port, available: false, error: err })
      } else {
        resolve({ port, available: false, error: err })
      }
    })
    server.once('listening', () => {
      server.close(() => resolve({ port, available: true }))
    })
    server.listen({ port, host, exclusive: true })
  })
}

function printEnvInfo() {
  const cwd = process.cwd()
  const hasLocal = fs.existsSync(path.resolve(cwd, '.env.local'))
  const hasEnv = fs.existsSync(path.resolve(cwd, '.env'))
  const envFile = hasLocal ? '.env.local' : (hasEnv ? '.env' : 'none')
  console.log(`[Env] Detected env file: ${envFile}`)
  if (envFile === 'none') {
    console.log('[Env] Tip: cp .env.example .env.local and fill variables.')
  }
}

function printAdvice(results) {
  const r5175 = results.find(r => r.port === 5175)
  const r8888 = results.find(r => r.port === 8888)

  console.log('--- Port Check Summary ---')
  console.log(`Vite 5175: ${r5175.available ? 'free' : 'BUSY'}`)
  console.log(`Netlify Dev 8888: ${r8888.available ? 'free' : 'BUSY'}`)

  if (!r5175.available) {
    console.log('\n[Action] Vite dev server uses strictPort=5175.')
    console.log('  - Close the process holding 5175 or temporarily edit vite.config.js')
    console.log('  Windows:')
    console.log('    netstat -ano | findstr :5175')
    console.log('    taskkill /F /PID <PID>')
  }

  if (!r8888.available) {
    console.log('\n[Action] Netlify Dev prefers port 8888. If busy:')
    console.log('  - Change `port = 9999` in netlify.toml and re-run.')
    console.log('  - Or run: npx netlify-cli dev --port 9999')
    console.log('  Windows:')
    console.log('    netstat -ano | findstr :8888')
    console.log('    taskkill /F /PID <PID>')
  }

  console.log('\n[Health] Default health URL: http://localhost:8888/.netlify/functions/health')
  console.log('        If you switched to 9999: http://localhost:9999/.netlify/functions/health')
}

async function main() {
  printEnvInfo()
  const results = await Promise.all([checkPort(5175), checkPort(8888)])
  printAdvice(results)
}

main().catch((e) => {
  console.error('[check-ports] Unexpected error:', e)
  process.exitCode = 1
})