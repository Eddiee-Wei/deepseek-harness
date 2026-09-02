/** Host Workspace Remote owner: explicit commands and reconnect-safe state. */

import { Context } from '@deepseek-ai/cordis'
import { openNativePathInApplication } from '@deepseek-ai/dsh-native-command'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { WorkspaceCommands } from './commands.ts'
import { DirectoryPickerController } from './directory-picker.ts'
import { WorkspaceFeed } from './feed.ts'
import {
  createWorkspaceBranch,
  createWorkspaceWorktree,
  inspectWorkspaceRepository,
  WorkspaceGitError,
  type WorkspaceGitInternals,
} from './workspace-git.ts'
import type {
  WorkspaceArchiveSessionRequest,
  WorkspaceArchiveValue,
  WorkspaceCreateRequest,
  WorkspaceCreateBranchRequest,
  WorkspaceCreateBranchValue,
  WorkspaceCreateWorktreeRequest,
  WorkspaceCreateWorktreeValue,
  WorkspaceCreateValue,
  WorkspaceDeleteRequest,
  WorkspaceDeleteValue,
  WorkspaceFollowFrame,
  WorkspaceInsertBeforeRequest,
  WorkspaceInsertSessionBeforeRequest,
  WorkspaceOrderValue,
  WorkspaceOpenPathWithRequest,
  WorkspaceOpenPathWithValue,
  WorkspaceRepositoryRequest,
  WorkspaceRepositoryValue,
  WorkspaceRenameRequest,
  WorkspaceValue,
} from './types.ts'

export type * from './types.ts'
export { DirectoryPickerController } from './directory-picker.ts'
export {
  createWorkspaceBranch,
  createWorkspaceWorktree,
  inspectWorkspaceRepository,
  WorkspaceGitError,
} from './workspace-git.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host Workspace business API and Remote namespace owner. */
    workspaceController: WorkspaceController
  }
}

/** Replaceable native integrations used by direct controller tests. */
export interface WorkspaceControllerInternals extends WorkspaceGitInternals {
  /** Named macOS application handoff. */
  readonly openPathWith?: typeof openNativePathInApplication
}

/** Host service backing the generated `ctx.remote.workspace` namespace. */
export class WorkspaceController extends TypertRemoteService {
  static inject = ['typert', 'workspaceRegistry']

  private readonly commands: WorkspaceCommands
  private readonly feed: WorkspaceFeed
  private readonly internals: WorkspaceControllerInternals
  private readonly openPathWith: typeof openNativePathInApplication

  /**
   * @param ctx - Host context containing the Workspace registry.
   * @param internals - native process and managed-worktree seams for direct tests.
   */
  constructor(ctx: Context, internals: WorkspaceControllerInternals = {}) {
    super(ctx, 'workspaceController', { namespace: 'workspace' })
    this.commands = new WorkspaceCommands(ctx)
    this.feed = new WorkspaceFeed(ctx)
    this.internals = internals
    this.openPathWith = internals.openPathWith ?? openNativePathInApplication
    // This package is the Loader entry for both Remote owners it hosts: the
    // directory-picking seam is abstract and never an entry itself. The child
    // stays pending until a picking backend is composed, so a host without one
    // registers no picking namespace instead of answering an unservable verb.
    ctx.plugin(DirectoryPickerController)
  }

  /**
   * Create or idempotently resolve one Workspace over an existing directory.
   * @param request - directory path to register.
   * @returns the Workspace and whether this call created it.
   */
  @Remote('create')
  create(request: WorkspaceCreateRequest): Promise<WorkspaceCreateValue> {
    return this.commands.create(request)
  }

  /**
   * Rename one Workspace to a unique non-blank title.
   * @param request - Workspace identity and proposed title.
   * @returns the updated Workspace projection.
   */
  @Remote('rename')
  rename(request: WorkspaceRenameRequest): Promise<WorkspaceValue> {
    return this.commands.rename(request)
  }

  /**
   * Remove one Workspace registration while retaining files and Sessions.
   * @param request - Workspace identity to remove.
   * @returns deletion confirmation.
   */
  @Remote('delete')
  delete(request: WorkspaceDeleteRequest): Promise<WorkspaceDeleteValue> {
    return this.commands.delete(request)
  }

  /**
   * Move one Workspace within the registry display order.
   * @param request - moved Workspace and optional anchor.
   * @returns the complete resulting Workspace order.
   */
  @Remote('insertBefore')
  insertBefore(request: WorkspaceInsertBeforeRequest): Promise<WorkspaceOrderValue> {
    return this.commands.insertBefore(request)
  }

  /**
   * Move one accounted Session within a Workspace.
   * @param request - Workspace, Session, and optional anchor identities.
   * @returns the updated Workspace projection.
   */
  @Remote('insertSessionBefore')
  insertSessionBefore(request: WorkspaceInsertSessionBeforeRequest): Promise<WorkspaceValue> {
    return this.commands.insertSessionBefore(request)
  }

  /**
   * Hide one known Session from Workspace grouping surfaces.
   * @param request - Session identity to archive.
   * @returns the complete resulting archive set.
   */
  @Remote('archiveSession')
  archiveSession(request: WorkspaceArchiveSessionRequest): Promise<WorkspaceArchiveValue> {
    return this.commands.archiveSession(request)
  }

  /**
   * Inspect Git state for one registered Workspace.
   * @param request - registered Workspace identity.
   * @param signal - caller lifetime; abort terminates Git inspection.
   * @returns directory or Git repository state.
   */
  @Remote('repository')
  async repository(
    request: WorkspaceRepositoryRequest,
    signal: AbortSignal,
  ): Promise<WorkspaceRepositoryValue> {
    const path = this.commands.pathFor(request.workspaceId)
    return {
      repository: await inspectWorkspaceRepository(path, signal, this.internals),
    }
  }

  /**
   * Open one registered Workspace in an allowlisted macOS application.
   * @param request - Workspace identity and named destination.
   * @param signal - caller lifetime; abort terminates the native command.
   * @returns confirmation after LaunchServices accepts the request.
   */
  @Remote('openPathWith')
  async openPathWithApplication(
    request: WorkspaceOpenPathWithRequest,
    signal: AbortSignal,
  ): Promise<WorkspaceOpenPathWithValue> {
    const path = this.commands.pathFor(request.workspaceId)
    signal.throwIfAborted()
    try {
      await this.openPathWith(path, request.application, signal, this.internals)
      return { opened: true }
    } catch (error: unknown) {
      if (signal.aborted) throw new RemoteError('gateway/cancelled', 'Workspace open was aborted', {})
      throw new RemoteError(
        'gateway/internal',
        `Workspace open failed: ${error instanceof Error ? error.message : String(error)}`,
        {},
      )
    }
  }

  /**
   * Create and switch to a new branch in one registered Workspace.
   * @param request - Workspace identity and previously unused branch name.
   * @param signal - caller lifetime; abort terminates Git commands.
   * @returns repository state after the branch switch.
   */
  @Remote('createBranch')
  async createBranch(
    request: WorkspaceCreateBranchRequest,
    signal: AbortSignal,
  ): Promise<WorkspaceCreateBranchValue> {
    const path = this.commands.pathFor(request.workspaceId)
    try {
      return {
        repository: await createWorkspaceBranch(path, request.branch, signal, this.internals),
      }
    } catch (error: unknown) {
      throw mapWorkspaceGitError(request.workspaceId, request.branch, error)
    }
  }

  /**
   * Create a linked worktree and register it as a Workspace.
   * @param request - Workspace identity and previously unused branch name.
   * @param signal - caller lifetime; abort terminates Git commands.
   * @returns the registered Workspace backed by the new worktree.
   */
  @Remote('createWorktree')
  async createWorktree(
    request: WorkspaceCreateWorktreeRequest,
    signal: AbortSignal,
  ): Promise<WorkspaceCreateWorktreeValue> {
    const path = this.commands.pathFor(request.workspaceId)
    try {
      const created = await createWorkspaceWorktree(path, request.branch, signal, this.internals)
      const registered = await this.commands.create({ path: created.path })
      return { workspace: registered.workspace }
    } catch (error: unknown) {
      throw mapWorkspaceGitError(request.workspaceId, request.branch, error)
    }
  }

  /**
   * Stream a complete Workspace baseline followed by ordered increments.
   * @param signal - generation cancellation.
   * @returns baseline followed by ordered Workspace increments.
   */
  @Remote({ mode: 'stream' })
  follow(signal: AbortSignal): AsyncIterable<WorkspaceFollowFrame> {
    return this.feed.follow(signal)
  }
}

function mapWorkspaceGitError(
  workspaceId: WorkspaceCreateBranchRequest['workspaceId'],
  branch: string,
  error: unknown,
): unknown {
  if (!(error instanceof WorkspaceGitError)) return error
  switch (error.code) {
    case 'workspace-not-git':
      return new RemoteError('workspace/not-git', error.message, { workspaceId }, { cause: error })
    case 'workspace-git-dirty':
      return new RemoteError('workspace/git-dirty', error.message, { workspaceId }, { cause: error })
    case 'workspace-branch-invalid':
      return new RemoteError('workspace/branch-invalid', error.message, { workspaceId, branch }, { cause: error })
    case 'workspace-branch-exists':
      return new RemoteError('workspace/branch-exists', error.message, { workspaceId, branch }, { cause: error })
    case 'workspace-worktree-exists':
      return new RemoteError('workspace/worktree-exists', error.message, { workspaceId }, { cause: error })
    default:
      return assertNever(error.code)
  }
}

function assertNever(value: never): never {
  throw new Error(`unreachable Workspace Git error code: ${String(value)}`)
}

export default WorkspaceController
