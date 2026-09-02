/** Safe Git inspection and workspace mutations for registered Host Workspaces. */

import { createHash } from 'node:crypto'
import { lstat, mkdir } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { runNativeCommand, type NativeCommandRunner } from '@deepseek-ai/dsh-native-command'

/** Git state shown by Workspace settings. */
export type WorkspaceRepositoryInfo =
  | { kind: 'directory' }
  | { kind: 'git'; root: string; branch?: string; detached: boolean; dirty: boolean }

/** Stable business refusals exposed by workspace Git RPC methods. */
export type WorkspaceGitErrorCode =
  | 'workspace-not-git'
  | 'workspace-git-dirty'
  | 'workspace-branch-invalid'
  | 'workspace-branch-exists'
  | 'workspace-worktree-exists'

/** Expected Git-workspace refusal. Unexpected process/filesystem failures propagate. */
export class WorkspaceGitError extends Error {
  /**
   * @param code - Stable wire-facing refusal category.
   * @param message - User-facing detail.
   */
  constructor(readonly code: WorkspaceGitErrorCode, message: string) {
    super(message)
    this.name = 'WorkspaceGitError'
  }
}

/** Injectable process and managed-root seams for deterministic tests. */
export interface WorkspaceGitInternals {
  /** Shell-free native command runner. */
  run?: NativeCommandRunner
  /** Directory that owns linked worktrees created by this integration. */
  worktreeRoot?: string
}

interface NativeFailure extends Error {
  code?: unknown
  stderr?: unknown
}

/** True for Git's ordinary non-match/process refusal rather than a missing executable. */
function isCommandFailure(error: unknown): error is NativeFailure {
  return error instanceof Error && 'code' in error && (error as NativeFailure).code !== 'ENOENT'
}

/** Execute Git without a shell and trim its line-oriented stdout. */
async function git(
  cwd: string,
  args: readonly string[],
  signal: AbortSignal,
  run: NativeCommandRunner,
): Promise<string> {
  const result = await run('git', ['-C', cwd, ...args], signal)
  signal.throwIfAborted()
  return result.stdout.replace(/[\r\n]+$/, '')
}

/**
 * Inspect an existing directory without treating a non-repository as a failure.
 * @param path - Registered Workspace directory.
 * @param signal - Cancellation signal for native Git processes.
 * @param internals - Optional deterministic process seams for tests.
 * @returns The directory or Git repository state shown by Workspace settings.
 */
export async function inspectWorkspaceRepository(
  path: string,
  signal: AbortSignal,
  internals: WorkspaceGitInternals = {},
): Promise<WorkspaceRepositoryInfo> {
  const run = internals.run ?? runNativeCommand
  let root: string
  try {
    root = await git(path, ['rev-parse', '--show-toplevel'], signal, run)
  } catch (error: unknown) {
    if (signal.aborted) throw error
    if (isCommandFailure(error)) return { kind: 'directory' }
    throw error
  }
  let branch: string | undefined
  try {
    branch = await git(path, ['symbolic-ref', '--quiet', '--short', 'HEAD'], signal, run)
  } catch (error: unknown) {
    if (signal.aborted || !isCommandFailure(error)) throw error
  }
  const status = await git(path, ['status', '--porcelain=v1', '--untracked-files=normal'], signal, run)
  return {
    kind: 'git',
    root,
    ...(branch === undefined || branch === '' ? {} : { branch }),
    detached: branch === undefined || branch === '',
    dirty: status !== '',
  }
}

/** Require a valid new local branch name that does not already exist. */
async function validateNewBranch(
  path: string,
  branch: string,
  signal: AbortSignal,
  run: NativeCommandRunner,
): Promise<void> {
  try {
    await git(path, ['check-ref-format', '--branch', branch], signal, run)
  } catch (error: unknown) {
    if (signal.aborted || !isCommandFailure(error)) throw error
    throw new WorkspaceGitError('workspace-branch-invalid', `invalid branch name "${branch}"`)
  }
  try {
    await git(path, ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], signal, run)
  } catch (error: unknown) {
    if (signal.aborted || !isCommandFailure(error)) throw error
    return
  }
  throw new WorkspaceGitError('workspace-branch-exists', `branch "${branch}" already exists`)
}

/**
 * Create and switch to a new branch in the registered Workspace's current worktree.
 * @param path - Registered Workspace directory.
 * @param branch - Valid, previously unused local branch name.
 * @param signal - Cancellation signal for native Git processes.
 * @param internals - Optional deterministic process seams for tests.
 * @returns The repository state after switching to the new branch.
 */
export async function createWorkspaceBranch(
  path: string,
  branch: string,
  signal: AbortSignal,
  internals: WorkspaceGitInternals = {},
): Promise<WorkspaceRepositoryInfo> {
  const run = internals.run ?? runNativeCommand
  const info = await inspectWorkspaceRepository(path, signal, { run })
  if (info.kind !== 'git') {
    throw new WorkspaceGitError('workspace-not-git', 'this workspace is not inside a Git repository')
  }
  if (info.dirty) {
    throw new WorkspaceGitError(
      'workspace-git-dirty',
      'commit or discard current changes before switching this worktree to a new branch',
    )
  }
  await validateNewBranch(path, branch, signal, run)
  await git(path, ['switch', '-c', branch], signal, run)
  return await inspectWorkspaceRepository(path, signal, { run })
}

/** Map a repository/branch pair to one deterministic Harness-owned worktree directory. */
function managedWorktreePath(repositoryRoot: string, branch: string, root: string): string {
  const repository = basename(repositoryRoot).replace(/[^A-Za-z0-9._-]+/g, '-') || 'repository'
  const branchPath = branch.replaceAll('/', '--').replace(/[^A-Za-z0-9._-]+/g, '-') || 'branch'
  const identity = createHash('sha256').update(repositoryRoot).digest('hex').slice(0, 10)
  return join(root, `${repository}-${identity}`, branchPath)
}

/**
 * Create a linked worktree on a new branch under the Harness-owned worktree root.
 * @param path - Registered Workspace directory.
 * @param branch - Valid, previously unused local branch name.
 * @param signal - Cancellation signal for native Git processes.
 * @param internals - Optional deterministic process and managed-root seams for tests.
 * @returns The managed worktree path and its Git repository state.
 */
export async function createWorkspaceWorktree(
  path: string,
  branch: string,
  signal: AbortSignal,
  internals: WorkspaceGitInternals = {},
): Promise<{ path: string; repository: WorkspaceRepositoryInfo }> {
  const run = internals.run ?? runNativeCommand
  const info = await inspectWorkspaceRepository(path, signal, { run })
  if (info.kind !== 'git') {
    throw new WorkspaceGitError('workspace-not-git', 'this workspace is not inside a Git repository')
  }
  if (info.dirty) {
    throw new WorkspaceGitError(
      'workspace-git-dirty',
      'commit or discard current changes before creating a linked worktree',
    )
  }
  await validateNewBranch(path, branch, signal, run)
  const target = managedWorktreePath(info.root, branch, internals.worktreeRoot ?? dshHomePath('worktrees'))
  try {
    await lstat(target)
    throw new WorkspaceGitError('workspace-worktree-exists', `worktree path already exists: ${target}`)
  } catch (error: unknown) {
    if (error instanceof WorkspaceGitError) throw error
    if (!(error instanceof Error) || !('code' in error) || (error as { code?: unknown }).code !== 'ENOENT') throw error
  }
  await mkdir(dirname(target), { recursive: true })
  await git(path, ['worktree', 'add', '-b', branch, target], signal, run)
  return { path: target, repository: await inspectWorkspaceRepository(target, signal, { run }) }
}
