/**
 * Built-runtime smoke for the macOS bundle. It starts the deployed CLI with
 * plain bundled Node.js, proves the access fence, and shuts down the owned
 * process before packaging continues.
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'

const [runtimeRoot] = process.argv.slice(2)
if (runtimeRoot === undefined) throw new Error('usage: verify-runtime.mjs <deployed runtime root>')

const root = resolve(runtimeRoot)
const node = resolve(root, '../node/bin/node')
const entry = resolve(root, 'node_modules/@deepseek-ai/dsh/lib/bin.js')
const scratch = await mkdtemp(join(tmpdir(), 'dsh-macos-runtime-'))
const environment = {
  ...process.env,
  DSH_HOME: join(scratch, 'home'),
  DSH_AGENTS_HOME: join(scratch, 'agents'),
  NO_COLOR: '1',
}
delete environment.NODE_OPTIONS
delete environment.NODE_PATH
const child = spawn(node, [entry, 'web', '--host', '127.0.0.1', '--port', '0', '--no-open'], {
  cwd: scratch,
  env: environment,
  stdio: ['ignore', 'pipe', 'pipe'],
})

let output = ''
let settled = false
const readiness = new Promise((resolveReady, rejectReady) => {
  const observe = (chunk) => {
    output += String(chunk)
    const match = output.match(/dsh web: (http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]{32,})/)
    if (match?.[1] !== undefined) resolveReady(match[1])
  }
  child.stdout.on('data', observe)
  child.stderr.on('data', observe)
  child.once('exit', (code, signal) => {
    if (!settled) rejectReady(new Error(`bundled dsh exited before readiness (${String(code)}, ${String(signal)}):\n${output}`))
  })
})

const timeout = new Promise((_, rejectTimeout) => {
  setTimeout(() => rejectTimeout(new Error(`bundled dsh readiness timed out:\n${output}`)), 60_000).unref()
})

try {
  const url = await Promise.race([readiness, timeout])
  settled = true
  const unauthorized = await fetch(url)
  if (unauthorized.status !== 401) throw new Error(`unauthenticated request returned ${String(unauthorized.status)}, expected 401`)

  const bootstrap = await fetch(url, { redirect: 'manual' })
  const cookie = bootstrap.headers.get('set-cookie')?.split(';', 1)[0]
  if (bootstrap.status !== 303 || cookie === undefined) {
    throw new Error(`bootstrap returned ${String(bootstrap.status)} without an access cookie`)
  }
  const authenticated = await fetch(url, { headers: { cookie } })
  if (authenticated.status !== 200) throw new Error(`authenticated request returned ${String(authenticated.status)}, expected 200`)
} finally {
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM')
  await new Promise(resolveExit => {
    if (child.exitCode !== null || child.signalCode !== null) resolveExit()
    else child.once('exit', resolveExit)
  })
  await rm(scratch, { recursive: true, force: true })
}

console.log('macOS runtime smoke: bundled CLI, loopback fence, and authenticated bootstrap passed')
