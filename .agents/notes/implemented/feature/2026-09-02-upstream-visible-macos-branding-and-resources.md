# Agent Note: Upstream-visible macOS branding and local resources

Status: implemented

English | [中文](2026-09-02-upstream-visible-macos-branding-and-resources.zh.md)

## Problem

The macOS distribution presents the upstream DeepSeek Harness runtime, but its separate `DSH Desktop` name and terminal-style icon obscure that relationship and provide no direct path to the skill roots, local Harness data, or packaged notices. Showing a build badge beside the product name also crowds the primary navigation row, while omitting build identity entirely makes an installed test artifact difficult to identify.

## Decision

The community macOS distribution uses `DeepSeek Harness` as its visible application, window, Web document, sidebar, DMG, and artifact name, and rasterizes the repository-owned Web fish mark into the macOS icon. It uses the contributor-owned `io.github.eddieewei.deepseek-harness` bundle identifier and visible independent-community attribution in App metadata, the About panel, the Help menu, the DMG, and repository documentation. This naming choice describes the bundled upstream runtime; it does not claim sponsorship, endorsement, or approval by DeepSeek.

Product-branded sidebar builds keep the name on one line and expose `version[-commit][-dirty]` in the pointer tooltip. Generic Web builds continue to display the same build identity as a badge below their localized local-build label. The native About panel also shows the bundled Harness version, source revision, and community-build status.

The standard presets remain the only skill integration. They load skills from the current Workspace and the established `.dsh/skills`, `.agents/skills`, `~/.dsh/skills`, and `~/.agents/skills` roots. The desktop shell does not introduce a private catalog or protocol. Its Help menu opens the user skill root, Harness data root, packaged resources, attribution, and runtime log; Settings remains the owner of plugin inventory and Workspace/Git controls.

## Alternatives considered

**Keep `DSH Desktop` and add a larger subtitle.** Rejected because the installed application, Dock item, and sidebar would still conceal the runtime users intentionally chose.

**Copy or redraw a similar fish icon.** Rejected because the repository already contains the exact source asset; a derivative would reduce consistency and complicate attribution.

**Create a desktop-only skill manager.** Rejected because it would duplicate the Harness filesystem provider and loader, split resource ownership, and increase the update cost of the thin shell.

## Consequences

The installed App and release artifacts are immediately identifiable as DeepSeek Harness, while the neutral bundle identifier and packaged notices continue to distinguish this community distribution from an official vendor release. Users can inspect the exact adapted build without permanent badge clutter and can reach skill, data, resource, attribution, and log locations through native menus. Future upstream syncs continue to update one shared agent, plugin, permission, session, and skill implementation rather than a desktop fork.
