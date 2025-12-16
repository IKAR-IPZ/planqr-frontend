/// <reference types="node" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import fs from 'fs'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const siteUrl = env.VITE_SITE_URL // Np. https://planqr.wi.zut.edu.pl


  const certKeyPath = path.resolve(__dirname, '../certs/cert.key')
  const certPemPath = path.resolve(__dirname, '../certs/cert.pem')
  const hasCerts = fs.existsSync(certKeyPath) && fs.existsSync(certPemPath)

  return {
    server: {
      https: hasCerts ? {
        key: fs.readFileSync(certKeyPath),
        cert: fs.readFileSync(certPemPath),
      } : undefined,
      port: 443,
      host: true,
      proxy: {
        '/schedule_student.php': {
          target: 'https://plan.zut.edu.pl', // Możesz dodać też to do .env, jeśli chcesz
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/schedule_student.php/, '/schedule_student.php'),
        },
        '/schedule.php': {
          target: 'https://plan.zut.edu.pl',
          changeOrigin: true,
          secure: false,
        },
        '/api': {
          target: siteUrl,
          changeOrigin: true,
          secure: false,
          // rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
      hmr: {
        host: new URL(siteUrl).hostname, // Używa samej domeny np. planqr.wi.zut.edu.pl
        protocol: 'wss',
      },
    },
    plugins: [react()],
  }
})