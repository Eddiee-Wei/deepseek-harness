/** Current-Workspace developer launcher and safe Git settings surface. */

import { useEffect, useMemo, useState } from 'react'
import {
  Button, IconBranchOutline16, IconBrowseOutline16, IconChevronDownOutline14,
  IconCodeOutline16, IconCordisPluginOutline14, IconFolderOpenOutline16,
  IconSettingsOutline16, Input, Menu, Modal,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  WorkspacePathApplication,
  WorkspaceRepositoryView,
} from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { WorkspaceDeveloperControlsProps } from './contract/slots.ts'
import css from './WorkspaceDeveloperControls.module.css'

const APPLICATION_BY_MENU_ID: Readonly<Record<string, WorkspacePathApplication | undefined>> = {
  vscode: 'vscode',
  cursor: 'cursor',
  finder: 'finder',
  terminal: 'terminal',
}

/**
 * Render the compact open-in menu and repository settings for the current Workspace.
 * @param props - session-scoped runtime hooks, Host actions, and localized copy.
 * @returns the controls, or null for an unregistered Session directory.
 */
export function WorkspaceDeveloperControls({
  sessionId, useWorkspaces, openPathWith, repository, createBranch, createWorktree, startSession, t,
}: WorkspaceDeveloperControlsProps) {
  const workspace = useWorkspaces(state => state.items.find(item => item.sessionIds.includes(sessionId)))
  const isMacosDesktop = document.documentElement.dataset.dshDesktop === 'macos'
  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [repositoryState, setRepositoryState] = useState<WorkspaceRepositoryView | null>(null)
  const [branch, setBranch] = useState('')
  const [busy, setBusy] = useState<'branch' | 'worktree' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!settingsOpen || workspace === undefined) return
    let live = true
    setRepositoryState(null)
    void repository(workspace.workspaceId).then(
      (value) => { if (live) setRepositoryState(value) },
      (reason: unknown) => { if (live) setError(reason instanceof Error ? reason.message : String(reason)) },
    )
    return () => { live = false }
  }, [repository, settingsOpen, workspace])

  const menuItems = useMemo(() => [
    { id: 'vscode', label: t('developer.open.vscode'), icon: <IconBrowseOutline16 /> },
    { id: 'cursor', label: t('developer.open.cursor'), icon: <IconCordisPluginOutline14 /> },
    { id: 'finder', label: t('developer.open.finder'), icon: <IconFolderOpenOutline16 /> },
    { id: 'terminal', label: t('developer.open.terminal'), icon: <IconCodeOutline16 /> },
    { type: 'separator' as const, id: 'settings-separator' },
    { id: 'settings', label: t('developer.settings'), icon: <IconSettingsOutline16 /> },
  ], [t])

  if (!isMacosDesktop || workspace === undefined) return null

  const trimmedBranch = branch.trim()
  const git = repositoryState?.kind === 'git' ? repositoryState : null
  const mutationDisabled = git === null || trimmedBranch === '' || busy !== null

  const runBranch = (): void => {
    if (mutationDisabled) return
    setBusy('branch')
    setError(null)
    void createBranch(workspace.workspaceId, trimmedBranch).then(
      (value) => {
        setRepositoryState(value)
        setBranch('')
        setBusy(null)
      },
      (reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason))
        setBusy(null)
      },
    )
  }

  const runWorktree = (): void => {
    if (mutationDisabled) return
    setBusy('worktree')
    setError(null)
    void createWorktree(workspace.workspaceId, trimmedBranch).then(
      (created) => {
        setBusy(null)
        setSettingsOpen(false)
        setBranch('')
        startSession(created.workspaceId)
      },
      (reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason))
        setBusy(null)
      },
    )
  }

  return (
    <>
      <Menu
        open={menuOpen}
        onClose={() => { setMenuOpen(false) }}
        items={menuItems}
        onSelect={(id) => {
          setMenuOpen(false)
          if (id === 'settings') {
            setError(null)
            setSettingsOpen(true)
            return
          }
          const application = APPLICATION_BY_MENU_ID[id]
          if (application === undefined) return
          void openPathWith(workspace.workspaceId, application).catch((reason: unknown) => {
            setError(reason instanceof Error ? reason.message : String(reason))
            setSettingsOpen(true)
          })
        }}
        align="end"
        portal
        className={css.menu ?? ''}
        anchor={(
          <button
            type="button"
            className={css.launcher}
            aria-label={t('developer.open.aria')}
            aria-expanded={menuOpen}
            onClick={() => { setMenuOpen(value => !value) }}
          >
            <span className={css.launcherIcon}><IconCordisPluginOutline14 /></span>
            <span className={css.launcherChevron}><IconChevronDownOutline14 /></span>
          </button>
        )}
      />

      <Modal
        open={settingsOpen}
        onClose={() => { if (busy === null) setSettingsOpen(false) }}
        title={t('developer.settings.title')}
        closeLabel={t('developer.close')}
        description={t('developer.settings.description')}
        className={css.dialog ?? ''}
        footer={(
          <>
            <Button variant="ghost" disabled={busy !== null} onClick={() => { setSettingsOpen(false) }}>
              {t('developer.cancel')}
            </Button>
            <Button variant="outline" disabled={mutationDisabled} onClick={runBranch}>
              {t('developer.branch.create')}
            </Button>
            <Button variant="primary" disabled={mutationDisabled} onClick={runWorktree}>
              {t('developer.worktree.create')}
            </Button>
          </>
        )}
      >
        <div className={css.workspaceIdentity}>
          <IconFolderOpenOutline16 />
          <div>
            <strong>{workspace.title}</strong>
            <span title={workspace.path}>{workspace.path}</span>
          </div>
        </div>

        {repositoryState === null && error === null && (
          <p className={css.muted}>{t('developer.settings.loading')}</p>
        )}
        {repositoryState?.kind === 'directory' && (
          <p className={css.notice}>{t('developer.settings.notGit')}</p>
        )}
        {git !== null && (
          <div className={css.repositoryCard}>
            <dl>
              <div>
                <dt>{t('developer.settings.repository')}</dt>
                <dd title={git.root}>{git.root}</dd>
              </div>
              <div>
                <dt>{t('developer.settings.branch')}</dt>
                <dd>{git.detached ? t('developer.settings.detached') : git.branch}</dd>
              </div>
            </dl>
            <span className={git.dirty ? css.dirty : css.clean}>
              {git.dirty ? t('developer.settings.dirty') : t('developer.settings.clean')}
            </span>
          </div>
        )}
        {error !== null && (
          <div className={css.error} role="alert">
            <strong>{t('developer.error.title')}</strong>
            <span>{error}</span>
          </div>
        )}
        <label className={css.branchField}>
          <span>{t('developer.branch.label')}</span>
          <Input
            value={branch}
            placeholder={t('developer.branch.placeholder')}
            disabled={git === null || busy !== null}
            onChange={(event) => { setBranch(event.target.value) }}
            onKeyDown={(event) => { if (event.key === 'Enter') runWorktree() }}
            icon={<IconBranchOutline16 />}
          />
          <small>{t('developer.branch.help')}</small>
        </label>
      </Modal>
    </>
  )
}
