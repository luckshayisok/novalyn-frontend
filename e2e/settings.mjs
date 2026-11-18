// Shared by the Playwright config, the API launcher and the tests.
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const E2E_API_PORT = Number(process.env.E2E_API_PORT ?? 8100)
export const E2E_WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 4174)
export const E2E_DIR = process.env.E2E_DIR ?? join(tmpdir(), 'novalyn-e2e')
