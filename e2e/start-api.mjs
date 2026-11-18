// Start a throwaway NOVALYN API for the end-to-end tests: a fresh SQLite database,
// emails written to files the tests read, uploads in a temporary folder.
//
// BACKEND_DIR points at a checkout of novalyn-backend (default: ../novalyn-backend, then ../backend).
// E2E_PYTHON overrides the Python interpreter (default: the backend's .venv).
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { E2E_API_PORT, E2E_DIR, E2E_WEB_PORT } from './settings.mjs'

const candidates = [process.env.BACKEND_DIR, '../novalyn-backend', '../backend'].filter(Boolean)
const backend = candidates.map((dir) => resolve(dir)).find((dir) => existsSync(join(dir, 'run_dev.py')))
if (!backend) {
  console.error(`No backend found. Set BACKEND_DIR (looked in ${candidates.join(', ')}).`)
  process.exit(1)
}
const python =
  process.env.E2E_PYTHON ??
  [join(backend, '.venv', 'Scripts', 'python.exe'), join(backend, '.venv', 'bin', 'python')].find(existsSync) ??
  'python'

rmSync(E2E_DIR, { recursive: true, force: true })

const env = {
  ...process.env,
  ENVIRONMENT: 'development',
  DATABASE_URL: `sqlite:///${join(E2E_DIR, 'novalyn.db').replaceAll('\\', '/')}`,
  EMAIL_BACKEND: 'file',
  EMAIL_FILE_DIR: join(E2E_DIR, 'mail'),
  STORAGE_BACKEND: 'local',
  STORAGE_LOCAL_DIR: join(E2E_DIR, 'files'),
  FRONTEND_URL: `http://127.0.0.1:${E2E_WEB_PORT}`,
  AI_PROVIDER: 'heuristic',
  OCR_BACKEND: 'none',
  DEFAULT_PLAN: 'growth',
  CELERY_TASK_ALWAYS_EAGER: 'true',
  REDIS_URL: '',
  CELERY_BROKER_URL: '',
  STRIPE_SECRET_KEY: '',
  RAZORPAY_KEY_ID: '',
  COOKIE_SECURE: 'false',
  PORT: String(E2E_API_PORT),
  RELOAD: 'false',
  LOG_LEVEL: 'WARNING',
}

const migrate = spawnSync(python, ['-m', 'alembic', 'upgrade', 'head'], { cwd: backend, env, stdio: 'inherit' })
if (migrate.status !== 0) process.exit(migrate.status ?? 1)

const api = spawn(python, ['run_dev.py'], { cwd: backend, env, stdio: 'inherit' })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => api.kill(signal))
api.on('exit', (code) => process.exit(code ?? 0))
