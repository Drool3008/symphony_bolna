import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { TestProject } from 'vitest/node'

/** A spare port, away from 8787 (a backend someone runs) and 8797 (the browser tests). */
export const CONTRACT_PORT = 8798

let server: ChildProcess | null = null
let dir: string | null = null

export default async function setup(project: TestProject) {
  dir = mkdtempSync(join(tmpdir(), 'vantari-web-contract-'))
  server = spawn('npm', ['run', 'start', '-w', '@family-health/server'], {
    cwd: resolve(import.meta.dirname, '../../..'),
    env: {
      ...process.env,
      MODEL_PROVIDER: 'stub',
      STUB_THINK_MS: '0',
      OPERATOR_AUTO: '',
      PORT: String(CONTRACT_PORT),
      DATABASE_PATH: join(dir, 'session.sqlite'),
    },
    stdio: 'ignore',
    detached: true,
  })
  const base = `http://localhost:${CONTRACT_PORT}`
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`${base}/api/members`)).ok) break
    } catch {
      // Not up yet.
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  project.provide('backend', base)

  return () => {
    if (server?.pid) process.kill(-server.pid, 'SIGTERM')
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
}

declare module 'vitest' {
  export interface ProvidedContext {
    backend: string
  }
}
