/// <reference types="node" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import fs from 'fs'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootEnvDir = path.resolve(__dirname, '..')

const getRequiredEnv = (env: Record<string, string>, key: string, defaultValue: string) => {
  return env[key] || defaultValue
}

const normalizeUrl = (value: string) => {
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value
  }

  return `http://${value}`
}

const toProxyConfig = (value: string) => {
  const url = new URL(normalizeUrl(value))

  return {
    origin: `${url.protocol}//${url.host}`,
    path: `${url.pathname}${url.search}`,
  }
}

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, rootEnvDir, '')
  const certKeyPath = path.resolve(__dirname, '../certs/cert.key')
  const certPemPath = path.resolve(__dirname, '../certs/cert.pem')
  const hasCerts = fs.existsSync(certKeyPath) && fs.existsSync(certPemPath)

  const config = {
    envDir: rootEnvDir,
    envPrefix: ['VITE_', 'ZUT_'],
    plugins: [react()],
  }

  if (command !== 'serve') {
    return config
  }

  const frontendUrl = new URL(normalizeUrl(getRequiredEnv(env, 'FRONTEND_PUBLIC_URL')))
  const backendUrl = normalizeUrl(getRequiredEnv(env, 'BACKEND_PUBLIC_URL'))
  const studentScheduleProxy = toProxyConfig(getRequiredEnv(env, 'ZUT_SCHEDULE_STUDENT_URL'))
  const roomScheduleProxy = toProxyConfig(getRequiredEnv(env, 'ZUT_SCHEDULE_URL'))
  const frontendDevPort = Number(getRequiredEnv(env, 'FRONTEND_DEV_PORT'))

  return {
    ...config,
    server: {
      https: hasCerts ? {
        key: fs.readFileSync(certKeyPath),
        cert: fs.readFileSync(certPemPath),
      } : undefined,
      port: frontendDevPort,
      host: true,
      proxy: {
        '/schedule_student.php': {
          target: studentScheduleProxy.origin,
          changeOrigin: true,
          secure: false,
          rewrite: () => studentScheduleProxy.path,
        },
        '/schedule.php': {
          target: roomScheduleProxy.origin,
          changeOrigin: true,
          secure: false,
          rewrite: () => roomScheduleProxy.path,
        },
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
      },
      hmr: {
        host: frontendUrl.hostname,
        protocol: frontendUrl.protocol === 'https:' ? 'wss' : 'ws',
        clientPort: frontendUrl.port ? Number(frontendUrl.port) : frontendDevPort,
      },
    },
  }
})
