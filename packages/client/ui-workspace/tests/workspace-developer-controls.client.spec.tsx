// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type {
  WorkspaceId, WorkspaceSnapshot, WorkspaceView,
} from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceDeveloperControlsProps } from '../src/client/contract/slots.ts'
import { WorkspaceDeveloperControls } from '../src/client/WorkspaceDeveloperControls.tsx'
import { en } from '../src/client/locales.ts'

beforeEach(() => { document.documentElement.dataset.dshDesktop = 'macos' })
afterEach(() => {
  cleanup()
  delete document.documentElement.dataset.dshDesktop
})

const sessionId = 'session-1' as SessionId
const workspaceId = 'workspace-1' as WorkspaceId
const workspace: WorkspaceView = {
  workspaceId,
  path: '/projects/harness',
  title: 'harness',
  sessionIds: [sessionId],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}
const workspaceState: WorkspaceSnapshot = {
  items: [workspace],
  archivedSessionIds: [],
  state: 'idle',
  phase: 'ready',
  error: null,
}
const selectWorkspace = <T,>(selector: (state: WorkspaceSnapshot) => T): T => selector(workspaceState)

function mount(overrides: Partial<WorkspaceDeveloperControlsProps> = {}) {
  const props = {
    sessionId,
    useWorkspaces: selectWorkspace,
    useSessions: vi.fn(),
    useSession: vi.fn(),
    useProjection: vi.fn(),
    openPathWith: vi.fn(async () => {}),
    repository: vi.fn(async () => ({ kind: 'git' as const, root: '/projects/harness', branch: 'main', detached: false, dirty: false })),
    createBranch: vi.fn(async (_workspaceId: WorkspaceId, branch: string) => ({ kind: 'git' as const, root: '/projects/harness', branch, detached: false, dirty: false })),
    createWorktree: vi.fn(async (_workspaceId: WorkspaceId, branch: string) => ({ ...workspace, workspaceId: 'workspace-2' as WorkspaceId, path: `/worktrees/${branch}` })),
    startSession: vi.fn(),
    t: makeTranslate(en),
    ...overrides,
  } as unknown as WorkspaceDeveloperControlsProps
  render(<WorkspaceDeveloperControls {...props} />)
  return props
}

describe('WorkspaceDeveloperControls', () => {
  it('stays out of ordinary browser deployments', () => {
    delete document.documentElement.dataset.dshDesktop
    mount()
    expect(screen.queryByRole('button', { name: 'Open current workspace' })).toBeNull()
  })

  it('opens the current Workspace in the selected desktop application', async () => {
    const props = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Open current workspace' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'VS Code' }))
    await waitFor(() => { expect(props.openPathWith).toHaveBeenCalledWith(workspaceId, 'vscode') })
  })

  it('creates a linked worktree and opens its registered Workspace', async () => {
    const props = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Open current workspace' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Workspace settings…' }))
    await screen.findByText('Working tree clean')
    fireEvent.change(screen.getByPlaceholderText('For example, feature/new-ui'), { target: { value: 'feature/perfect-ui' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create worktree' }))
    await waitFor(() => {
      expect(props.createWorktree).toHaveBeenCalledWith(workspaceId, 'feature/perfect-ui')
      expect(props.startSession).toHaveBeenCalledWith('workspace-2')
    })
  })
})
