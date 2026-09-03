# Agent Note: Exact Harness identity for macOS releases

Status: implemented

English | [中文](2026-08-26-exact-macos-harness-release-identity.zh.md)

## Problem

The native macOS distribution packages a synchronized DeepSeek Harness runtime, but an App tag that removes the Harness prerelease suffix can identify different kernel code than the DMG actually contains. A fixed artifact filename also makes downloaded test builds ambiguous. This weakens release review and makes a reported App version insufficient to reproduce its agent runtime.

## Decision

The exact version in `apps/cli/package.json` is the macOS release identity and remains separate from the numeric `CFBundleShortVersionString` required by macOS. Every `test-v*` and `app-v*` tag suffix equals that exact version, including any prerelease suffix, or `.github/workflows/macos-release.yml` rejects the run before packaging. Stable `app-v*` tags use the Developer ID and notarization path; prerelease Harness versions use `test-v*`, whose ad hoc-signed GitHub Pre-release remains explicitly unsuitable for general distribution.

`apps/macos/package.json` participates in the `dsh` release family and uses the same exact version as the CLI and packaged workspaces. The release-family and install-layout checks reject any drift before the macOS workflow can publish an artifact.

`apps/macos/build.sh` independently compares the requested release version with the bundled CLI manifest. The App metadata records the exact Harness version and full Git source revision. The DMG filename, workflow artifact, GitHub Release name, and checksum filename include the same Harness version. These fields complement the self-contained runtime and security rules owned by the [native macOS desktop distribution](../feature/2026-08-17-native-macos-desktop-app.md); they do not create a second agent version or update channel.

## Alternatives considered

**Give the UI shell an independent public version.** Rejected because users and maintainers would need a separate compatibility table to determine which Harness kernel a desktop release contains.

**Strip prerelease suffixes from every App tag.** Rejected because different release candidates could share one visible release identity while containing different agent code.

**Download the newest Harness runtime when the App starts.** Rejected because the signed DMG would no longer determine the executable code it runs, and startup would depend on network and registry state.

## Consequences

Each published macOS artifact identifies one Harness kernel version and one source revision. A new upstream Harness version requires synchronized release manifests and a new matching App tag; an incorrect manifest or stale tag fails before signing or publication. Stable and prerelease channels remain distinct even though both use the exact kernel version in their names. The release workflow does not publish automatically after an upstream merge; a matching tag is still an explicit release decision.
