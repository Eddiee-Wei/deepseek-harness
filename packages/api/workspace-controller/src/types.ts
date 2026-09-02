/**
 * Browser-safe request, result, and state-stream vocabulary for the Workspace
 * and directory-picking Remote namespaces this package owns. The picking seam
 * declares its own listing types, so they are re-exported here rather than
 * restated: a browser consumer reads the very declaration the backend answers.
 */

import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'

export type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
export type { DirectoryEntry, DirectoryListing } from '@deepseek-ai/dsh-host-directory-picker/types'

/** One durable Workspace projected for browser consumers. */
export interface WorkspaceView {
  readonly workspaceId: WorkspaceId
  /** Canonical host directory path. */
  readonly path: string
  /** User-visible title. */
  readonly title: string
  /** Sessions accounted to this Workspace in manual order. */
  readonly sessionIds: readonly SessionId[]
  /** ISO-8601 creation instant. */
  readonly createdAt: string
  /** ISO-8601 last-mutation instant. */
  readonly updatedAt: string
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** The requested directory cannot back a Workspace. */
    'workspace/invalid-path': { readonly path: string }
    /** Another Workspace already uses the requested name. */
    'workspace/name-conflict': { readonly name: string }
    /** The Session or its anchor is not in the Workspace's manual order. */
    'workspace/move-invalid': {
      readonly workspaceId: WorkspaceId
      readonly sessionId: SessionId
      readonly beforeSessionId?: SessionId
    }
    /** The selected Workspace is not inside a Git repository. */
    'workspace/not-git': { readonly workspaceId: WorkspaceId }
    /** A branch or worktree mutation requires a clean repository. */
    'workspace/git-dirty': { readonly workspaceId: WorkspaceId }
    /** Git rejected the proposed local branch name. */
    'workspace/branch-invalid': { readonly workspaceId: WorkspaceId; readonly branch: string }
    /** The proposed local branch already exists. */
    'workspace/branch-exists': { readonly workspaceId: WorkspaceId; readonly branch: string }
    /** The managed worktree destination already exists. */
    'workspace/worktree-exists': { readonly workspaceId: WorkspaceId }
    /** The verb needs an interaction the composed backend does not serve. */
    'directory-picker/unavailable': { readonly capability: string }
    /** The target is not fully qualified, or the backend cannot list it. */
    'directory-picker/unreadable': { readonly path: string }
    /** A child of that name is already there. */
    'directory-picker/exists': { readonly path: string }
    /** The parent is not fully qualified, the name is not one segment, or creation failed. */
    'directory-picker/create-failed': { readonly path: string }
  }
}

/** Existing directory requested for Workspace adoption. */
export interface WorkspaceCreateRequest {
  readonly path: string
}

/** Created or previously registered Workspace. */
export interface WorkspaceCreateValue {
  readonly workspace: WorkspaceView
  readonly created: boolean
}

/** Workspace title mutation. */
export interface WorkspaceRenameRequest {
  readonly workspaceId: WorkspaceId
  readonly title: string
}

/** Workspace mutation returning the complete changed row. */
export interface WorkspaceValue {
  readonly workspace: WorkspaceView
}

/** Workspace registration deletion. */
export interface WorkspaceDeleteRequest {
  readonly workspaceId: WorkspaceId
}

/** Receipt after one Workspace registration is deleted. */
export interface WorkspaceDeleteValue {
  readonly deleted: true
}

/** DOM-insertBefore-like Workspace order mutation. */
export interface WorkspaceInsertBeforeRequest {
  readonly workspaceId: WorkspaceId
  readonly beforeWorkspaceId?: WorkspaceId
}

/** Complete Workspace registry order after a mutation. */
export interface WorkspaceOrderValue {
  readonly workspaceIds: readonly WorkspaceId[]
}

/** DOM-insertBefore-like Session membership order mutation. */
export interface WorkspaceInsertSessionBeforeRequest {
  readonly workspaceId: WorkspaceId
  readonly sessionId: SessionId
  readonly beforeSessionId?: SessionId
}

/** Session requested for archival from Workspace grouping surfaces. */
export interface WorkspaceArchiveSessionRequest {
  readonly sessionId: SessionId
}

/** Complete archived Session set after a mutation. */
export interface WorkspaceArchiveValue {
  readonly archivedSessionIds: readonly SessionId[]
}

/** Named macOS destinations exposed by the desktop Workspace launcher. */
export type WorkspacePathApplication = 'vscode' | 'cursor' | 'finder' | 'terminal'

/** Git state rendered by the desktop Workspace settings surface. */
export type WorkspaceRepositoryView =
  | { readonly kind: 'directory' }
  | {
    readonly kind: 'git'
    readonly root: string
    readonly branch?: string
    readonly detached: boolean
    readonly dirty: boolean
  }

/** Workspace identity used by repository inspection. */
export interface WorkspaceRepositoryRequest {
  readonly workspaceId: WorkspaceId
}

/** Repository inspection response. */
export interface WorkspaceRepositoryValue {
  readonly repository: WorkspaceRepositoryView
}

/** Named native-application handoff for one registered Workspace. */
export interface WorkspaceOpenPathWithRequest {
  readonly workspaceId: WorkspaceId
  readonly application: WorkspacePathApplication
}

/** Receipt after LaunchServices accepts a Workspace handoff. */
export interface WorkspaceOpenPathWithValue {
  readonly opened: true
}

/** New branch mutation for one registered Workspace. */
export interface WorkspaceCreateBranchRequest {
  readonly workspaceId: WorkspaceId
  readonly branch: string
}

/** Repository state after a new branch is checked out. */
export interface WorkspaceCreateBranchValue {
  readonly repository: WorkspaceRepositoryView
}

/** New linked-worktree mutation for one registered Workspace. */
export interface WorkspaceCreateWorktreeRequest {
  readonly workspaceId: WorkspaceId
  readonly branch: string
}

/** Registered Workspace created for a new linked worktree. */
export interface WorkspaceCreateWorktreeValue {
  readonly workspace: WorkspaceView
}

/** Complete reconnect baseline for Workspace browser state. */
export interface WorkspaceBaseline {
  readonly items: readonly WorkspaceView[]
  readonly archivedSessionIds: readonly SessionId[]
}

/** One ordered Workspace change after a generation's baseline. */
export type WorkspaceFollowIncrement =
  | { readonly type: 'upsert'; readonly workspace: WorkspaceView }
  | { readonly type: 'remove'; readonly workspaceId: WorkspaceId }
  | { readonly type: 'order'; readonly workspaceIds: readonly WorkspaceId[] }
  | { readonly type: 'archived'; readonly archivedSessionIds: readonly SessionId[] }

/** Workspace state stream; every generation starts with exactly one baseline. */
export type WorkspaceFollowFrame =
  | { readonly type: 'baseline'; readonly value: WorkspaceBaseline }
  | WorkspaceFollowIncrement
