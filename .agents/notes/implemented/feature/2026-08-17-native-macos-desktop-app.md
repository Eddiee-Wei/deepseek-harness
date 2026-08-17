# Agent Note: Native macOS desktop distribution over the Web composition

Status: implemented

English | [中文](2026-08-17-native-macos-desktop-app.zh.md)

## Problem

DeepSeek Harness has a browser surface with the session and plugin experience needed by a desktop coding agent, but it has no self-contained macOS application or signed disk image. A wrapper that reimplements the agent transport or vendors a modified agent loop would make the visual client costly to keep current with the upstream harness and could create a second permission or persistence model. A plain browser launcher would also leave a loopback code-execution surface reachable by unrelated browser origins and accidental local clients.

## Decision

`apps/macos` is a private deployment root and native Swift AppKit/WebKit shell over the existing `dsh web` composition. It is explicitly excluded from the npm release-member policy because its manifest describes the dependency closure copied into the signed application rather than a consumable JavaScript package. The application deploys production workspace packages, bundles an arm64 Node.js executable, and starts the published `@deepseek-ai/dsh` CLI under plain Node.js. The shell parses only the existing `dsh web:` readiness line. It does not import agent internals, alter `agent-loop`, invent a session format, or add a desktop-specific tool protocol.

The shell injects `html[data-dsh-desktop='macos']` before the first document paint. Client packages use that marker only for native title-bar clearance and small desktop geometry adjustments. DeepSeek Harness remains the visible product identity, while the window composition follows the Codex desktop layout: native window chrome, a persistent navigation sidebar, conversation canvas, composer, and optional details column.

Each launch binds the Web server to `127.0.0.1` on an OS-assigned port and generates a 256-bit URL-safe bootstrap token. `DSH_WEB_ACCESS_TOKEN` carries the token in the child environment without adding a public CLI flag or process argument. The webserver exchanges a matching top-level GET query for a host-only HttpOnly SameSite=Strict cookie, strips the query with a redirect, and rejects every other HTTP or upgrade request without that cookie. Token comparison is constant-time. Unconfigured Web compositions retain the previous unauthenticated behavior.

The WebKit store is non-persistent and navigation is restricted to the owned loopback origin. External user-clicked links open in the system browser. App termination owns the child lifecycle, first sending SIGTERM and then using a bounded SIGKILL fallback. Developer ID signing uses the hardened runtime; the bundled Node.js executable receives only the dynamic-code and library-validation exceptions required by its runtime and native addons. The application does not enable App Sandbox because the agent's supported work includes user-approved filesystem, terminal, subprocess, and language-server access; existing Harness policies continue to own those permissions.

`apps/macos/build.sh` deploys the runtime, runs a built-artifact smoke that proves the access fence, compiles the shell, signs nested Mach-O files from the inside out, verifies the app, creates and verifies a compressed DMG, and emits a SHA-256 file. `.github/workflows/macos-release.yml` uses pinned actions and an Apple Silicon runner. `app-v*` tags require Developer ID and notarization credentials and publish the verified DMG plus checksum to a GitHub Release. `test-v*` tags force ad hoc signing, skip notarization, and publish a clearly warned GitHub Pre-release for trusted testing. Manual runs may produce an artifact without publishing.

## Alternatives considered

**Fork the Web client and agent runtime into a separate desktop repository.** Rejected because every upstream session, transport, permission, and plugin change would need a second implementation and coordinated migration.

**Use Electron with a private IPC transport.** Rejected for the first release because the repository already owns a complete HTTP/WebSocket Web composition, while Electron would add another bundled browser runtime and preserve the historical file/IPC branch the current Web packages no longer need. A future cross-platform requirement can revisit this choice without changing the DSH runtime seam.

**Launch the user's installed `dsh` or download it on first run.** Rejected because installation state and network availability would determine whether the app starts, and a remote package update could change executable code independently of the signed DMG.

**Rely on loopback binding without authentication.** Rejected because loopback prevents remote network access but does not prevent unrelated local pages or processes from reaching a predictable application server.

**Enable App Sandbox.** Rejected because the current Harness product deliberately supports local subprocess, terminal, filesystem, and language-server capabilities. Constraining those behind a second entitlement and bookmark system would change the native agent rather than package it.

## Consequences

The desktop release stays close to upstream: most updates are ordinary workspace dependency and Web UI changes, and the native shell remains a small process supervisor and renderer. The artifact is self-contained, starts without a user-installed Node.js or runtime download, and closes the most direct loopback-confusion path. Formal distribution still has a hard Developer ID and notarization gate; the test-tag path does not weaken it or present an ad hoc-signed build as a normal release. The cost is a larger Apple Silicon-only DMG, a macOS-specific build, and Developer ID/notarization secret management for formal releases. The first release has no automatic updater, Intel binary, App Store sandbox, or promise that an arbitrary remote deployment can use the local token fence as its authentication system.
