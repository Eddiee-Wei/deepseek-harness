# DSH Desktop for macOS

English | [中文](README.zh.md)

This directory owns DSH Desktop, the independent community Apple Silicon distribution built on DeepSeek Harness. It is an additive presentation and packaging layer over the shipped `dsh web` composition: the Swift AppKit/WebKit shell starts the bundled Node.js and `@deepseek-ai/dsh` CLI, then renders the existing Web client. Agent, session, plugin, tool, permission, settings, and credential behavior remains owned by the normal DeepSeek Harness packages. The shell does not fork `agent-loop` or carry a private agent protocol, which keeps routine upstream updates limited to rebuilding the app and resolving ordinary package changes.

The window follows the Codex desktop page format while using the independent DSH Desktop name and original terminal-style icon: a compact native title bar, persistent left workspace/session navigation, a quiet conversation canvas, a centered composer, and the existing details/review column. The visible version remains the exact embedded DeepSeek Harness version. The shell injects only `html[data-dsh-desktop='macos']`; narrowly scoped client CSS uses that marker for native title-bar clearance and desktop geometry. An invisible AppKit view matching that clearance hands a single mouse-down event to `NSWindow.performDrag(with:)`, so dragging the top strip moves the native window without turning Web content into a drag target; a double-click invokes the window's native zoom action. Browser deployments keep their existing presentation.

Non-blank macOS sessions expose a compact Workspace launcher in the session header. It opens the registered Workspace in Visual Studio Code, Cursor, Finder, or Terminal and provides repository settings for inspecting Git state, creating and switching to a branch, or creating a linked worktree on a new branch. The browser sends only the registered Workspace id; the host resolves the canonical path and runs fixed-argument native `open` and `git` processes without a shell. Branch and worktree creation rejects dirty repositories and existing branch names, while the linked worktree is created under the private DSH home directory and registered through the normal Workspace service.

## Local build

The first release targets macOS 13 or newer on Apple Silicon. It requires an arm64 Node.js binary, the Xcode command-line tools, and an installed workspace.

```sh
pnpm run app:macos
pnpm run app:macos:dmg
```

The app and a versioned `DSH-Desktop-<Harness version>-macOS-arm64.dmg` are written below `.artifacts/macos/`. The build labels the desktop document as `DSH Desktop — DeepSeek Harness <version>` and the expanded sidebar as `DSH Desktop` plus the exact `@deepseek-ai/dsh` version in the synchronized checkout, including any prerelease suffix. It records that version, the full source revision, and the upstream URL in the App metadata, deploys production workspace packages, copies the current arm64 Node.js executable, starts the deployed CLI with plain bundled Node.js, proves the local access fence, compiles the Swift shell, generates the original app icon, signs every Mach-O dependency, verifies the app signature, creates and verifies the DMG, and writes a SHA-256 file. The `.app` can be copied to `/Applications` or installed through the DMG. Local builds use ad hoc signing unless `APPLE_SIGNING_IDENTITY` names a Developer ID Application certificate.

## Release

`.github/workflows/macos-release.yml` builds on an Apple Silicon GitHub runner. Configure these repository secrets before creating a signed release:

- `APPLE_CERTIFICATE_P12_BASE64`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY`
- `APPLE_ID`
- `APPLE_TEAM_ID`
- `APPLE_APP_PASSWORD`

The suffix of every release tag must equal the exact version in `apps/cli/package.json`; the workflow rejects a mismatched tag before packaging. For a stable Harness version, push a tag such as `app-v0.1.1` to build, Developer ID-sign, notarize, staple, verify, and publish the versioned DMG plus its SHA-256 file in a GitHub Release. The workflow refuses prerelease Harness versions on this channel and refuses publication when any Apple credential is missing.

For a Harness prerelease or when Apple credentials are unavailable, a tag such as `test-v0.1.2-alpha.4` publishes an explicitly labeled GitHub Pre-release whose release name and files carry the same exact Harness version and independent DSH Desktop identity. That test DMG is forced to use ad hoc signing and is not notarized, even if repository secrets are later configured. The Release warns that macOS may block normal installation and that the artifact is for trusted testing only; users should verify the attached SHA-256 file before opening it. Manual workflow runs build the exact checked-out Harness version without publishing a Release and use ad hoc signing when credentials are absent.

## Attribution

DSH Desktop is an independently maintained community application built on [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It is not sponsored, endorsed, or approved by DeepSeek. The repository landing page, App metadata and Help menu, application resources, and DMG identify the upstream project and include its MIT license. `ATTRIBUTION.txt` is the packaged notice; `DEEPSEEK_HARNESS_LICENSE`, `THIRD_PARTY_NOTICES.md`, and `NODE_LICENSE` carry the corresponding license texts. DeepSeek and DeepSeek Harness names and related marks belong to their respective owners.

## Security and ownership

The shell binds only to `127.0.0.1` on an OS-assigned port and generates a new 256-bit access token for each launch. This loopback server is the private transport between the embedded WebView and bundled Harness runtime, not a remotely reachable service. The token is passed through the child environment rather than process arguments, exchanged once for a host-only HttpOnly SameSite cookie, and removed from the navigation URL. HTTP and WebSocket access without the cookie is rejected. Both the native launcher and packaging smoke pass `--no-open`, so the private URL is not opened in the user's default browser. WebKit uses a non-persistent data store, navigation is restricted to the owned loopback origin, external user-clicked links open in the default browser, and quitting the app terminates its owned DSH service.

The app is hardened-runtime signed but is intentionally not App Sandbox constrained: native DeepSeek Harness tools need user-approved access to local workspaces, subprocesses, terminals, and language servers. Existing Harness permission and filesystem policies remain authoritative. Runtime logs live at `~/Library/Logs/DSH Desktop/runtime.log`; normal DSH settings, sessions, credentials, and plugins continue using their existing locations. The first release does not include automatic updates, Intel support, or Mac App Store distribution.
