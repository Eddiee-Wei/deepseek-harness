// Keyless assembled coverage for the macOS-only Workspace developer controls.
import { execFile } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import {
  assertFixtureInventory, captureStableAria, compareOrRefreshGolden, launchWebScaffold,
  seedSession, watchConsole, webSnapshotMode, type WebScaffold,
} from './scaffold.ts'
import { newEnglishPage, saveFailureShot } from './support.ts'

const execFileAsync = promisify(execFile)
const SNAPSHOT_DIR = fileURLToPath(new URL('./snapshots/workspace-developer-controls', import.meta.url))
const SEED = fileURLToPath(new URL('../../../snapshots/web/seeded-history/session.jsonl', import.meta.url))
const EXPECTED = join(SNAPSHOT_DIR, 'settings.expected.md')
const MODE = webSnapshotMode()

describe('web e2e: macOS Workspace developer controls', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>

  beforeAll(async () => {
    scaffold = await launchWebScaffold({})
    await writeFile(join(scaffold.workspaceCwd, '.gitignore'), '.agents-home/\n.bundled-skills/\n.dsh-storages/\n')
    await writeFile(join(scaffold.workspaceCwd, 'README.md'), '# Workspace developer controls fixture\n')
    await execFileAsync('git', ['-C', scaffold.workspaceCwd, 'init', '-b', 'main'])
    await execFileAsync('git', ['-C', scaffold.workspaceCwd, 'add', '.gitignore', 'README.md'])
    await execFileAsync('git', [
      '-C', scaffold.workspaceCwd, '-c', 'user.name=DeepSeek Harness',
      '-c', 'user.email=dsh@example.invalid', 'commit', '-m', 'fixture',
    ])

    const sessionId = await seedSession(
      scaffold,
      await readFile(SEED, 'utf8'),
      'workspace-developer-controls-web-e2e',
    )
    const workspace = await scaffold.ctx.workspaceRegistry.create(scaffold.workspaceCwd, 'developer-controls')
    await workspace.attachSession(sessionId)

    browser = await chromium.launch()
    page = await newEnglishPage(browser)
    await page.addInitScript(() => {
      const markDesktop = (): void => { document.documentElement?.setAttribute('data-dsh-desktop', 'macos') }
      markDesktop()
      new MutationObserver(markDesktop).observe(document, { childList: true })
    })
    tripwire = watchConsole(page)
    await page.goto(scaffold.authenticatedUrl, { waitUntil: 'load' })
    await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    await scaffold?.close()
  })

  it('offers fixed applications, reports Git state, and creates a managed linked worktree', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-workspace-developer-controls'))
    const group = page.locator('[role="treeitem"]').filter({ hasText: 'developer-controls' }).first()
    await group.waitFor({ timeout: 10_000 })
    const section = group.locator('xpath=ancestor::*[contains(@class, "groupSection")][1]')
    await expect.poll(async () => {
      if (await group.getAttribute('aria-expanded') !== 'true') await group.click()
      return await section.locator('[role="treeitem"]').count()
    }, { timeout: 10_000 }).toBeGreaterThanOrEqual(2)
    await section.locator('[role="treeitem"]').last().click()
    await page.getByRole('button', { name: 'Open current workspace' }).waitFor({ timeout: 10_000 })
    // Browser startup may materialize ignored or fixture-local host state.
    // Seal any non-ignored residue before asserting the repository view.
    await execFileAsync('git', ['-C', scaffold.workspaceCwd, 'add', '-A'])
    await execFileAsync('git', [
      '-C', scaffold.workspaceCwd, '-c', 'user.name=DeepSeek Harness',
      '-c', 'user.email=dsh@example.invalid', 'commit', '--allow-empty', '-m', 'settle fixture',
    ])
    await page.getByRole('button', { name: 'Open current workspace' }).click()
    for (const name of ['VS Code', 'Cursor', 'Finder', 'Terminal', 'Workspace settings…']) {
      await page.getByRole('menuitem', { name }).waitFor({ timeout: 5_000 })
    }
    await page.getByRole('menuitem', { name: 'Workspace settings…' }).click()
    const dialog = page.getByRole('dialog', { name: 'Workspace settings' })
    await dialog.waitFor({ timeout: 10_000 })
    await dialog.getByText('Working tree clean', { exact: true }).waitFor({ timeout: 10_000 })
    expect(await dialog.getByText('main', { exact: true }).count()).toBe(1)
    const snapshot = await captureStableAria(page, '[role="dialog"]', scaffold.workspaceCwd)
    await compareOrRefreshGolden(EXPECTED, snapshot, MODE)

    await dialog.getByPlaceholder('For example, feature/new-ui').fill('feature/web-e2e')
    await dialog.getByRole('button', { name: 'Create worktree' }).click()
    await dialog.waitFor({ state: 'hidden', timeout: 15_000 })
    await expect.poll(
      () => scaffold.ctx.workspaceRegistry.list().find(item => item.path.includes('feature--web-e2e')),
      { timeout: 10_000 },
    ).not.toBeUndefined()
    const createdWorkspace = scaffold.ctx.workspaceRegistry.list()
      .find(item => item.path.includes('feature--web-e2e'))
    if (createdWorkspace === undefined) throw new Error('managed worktree was not registered')
    const branch = await execFileAsync('git', ['-C', createdWorkspace.path, 'branch', '--show-current'])
    expect(branch.stdout.trim()).toBe('feature/web-e2e')
    expect(tripwire.pageErrors).toEqual([])
  }, 60_000)

  it.skipIf(MODE === 'record')('owns only its expected artifact and makes no model calls', async () => {
    expect(tripwire.warnings).toEqual([])
    await assertFixtureInventory(SNAPSHOT_DIR, ['.gitkeep', 'settings.expected.md'])
  })
})
