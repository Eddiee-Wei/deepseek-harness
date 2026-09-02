import { describe, expect, it, vi } from 'vitest'
import type { NativeCommandRunner } from '@deepseek-ai/dsh-native-command'
import {
  createWorkspaceBranch, createWorkspaceWorktree, inspectWorkspaceRepository,
} from '../src/workspace-git.ts'

const signal = () => new AbortController().signal
const failure = (code = 1): Error & { code: number; stderr: string } =>
  Object.assign(new Error('git refused'), { code, stderr: '' })

describe('Workspace Git operations', () => {
  it('reports a plain directory when rev-parse refuses it', async () => {
    const run = vi.fn<NativeCommandRunner>(async () => { throw failure(128) })
    await expect(inspectWorkspaceRepository('/plain', signal(), { run }))
      .resolves.toEqual({ kind: 'directory' })
  })

  it('refuses branch switching while the registered worktree is dirty', async () => {
    const run = vi.fn<NativeCommandRunner>(async (_command, args) => {
      if (args.includes('--show-toplevel')) return { stdout: '/repo\n', stderr: '' }
      if (args.includes('symbolic-ref')) return { stdout: 'main\n', stderr: '' }
      if (args.includes('status')) return { stdout: ' M file.ts\n', stderr: '' }
      return { stdout: '', stderr: '' }
    })
    await expect(createWorkspaceBranch('/repo', 'feature/ui', signal(), { run }))
      .rejects.toMatchObject({ code: 'workspace-git-dirty' })
    expect(run.mock.calls.some(([, args]) => args.includes('switch'))).toBe(false)
  })

  it('creates a linked worktree only after validating the new branch', async () => {
    const run = vi.fn<NativeCommandRunner>(async (_command, args) => {
      if (args.includes('--show-toplevel')) return { stdout: '/repo\n', stderr: '' }
      if (args.includes('symbolic-ref')) return { stdout: 'main\n', stderr: '' }
      if (args.includes('status')) return { stdout: '', stderr: '' }
      if (args.includes('show-ref')) throw failure()
      return { stdout: '', stderr: '' }
    })
    const created = await createWorkspaceWorktree('/repo', 'feature/ui', signal(), {
      run,
      worktreeRoot: '/tmp/dsh-worktree-test-root',
    })
    expect(created.path).toMatch(/\/repo-[a-f0-9]{10}\/feature--ui$/)
    expect(run.mock.calls.map(([, args]) => args)).toContainEqual([
      '-C', '/repo', 'worktree', 'add', '-b', 'feature/ui', created.path,
    ])
  })

  it('refuses a linked worktree while the registered worktree is dirty', async () => {
    const run = vi.fn<NativeCommandRunner>(async (_command, args) => {
      if (args.includes('--show-toplevel')) return { stdout: '/repo\n', stderr: '' }
      if (args.includes('symbolic-ref')) return { stdout: 'main\n', stderr: '' }
      if (args.includes('status')) return { stdout: '?? draft.txt\n', stderr: '' }
      return { stdout: '', stderr: '' }
    })
    await expect(createWorkspaceWorktree('/repo', 'feature/ui', signal(), { run }))
      .rejects.toMatchObject({ code: 'workspace-git-dirty' })
    expect(run.mock.calls.some(([, args]) => args.includes('worktree'))).toBe(false)
  })
})
