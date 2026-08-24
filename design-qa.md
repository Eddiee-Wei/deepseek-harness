# Design QA

## Target

- Reference: official Codex desktop imagery captured from `https://openai.com/codex/`.
- Prototype: the production Web client served by the runtime embedded in the generated macOS application.
- Viewport and state: 1440 × 1024, light theme, onboarding dismissed, empty workspace/session state.

## Comparison

- Structure: passed. The persistent left navigation, large quiet conversation canvas, centered primary composer, compact controls, and optional right-side review area follow the Codex desktop page format.
- Native composition: passed. The Swift window uses a transparent full-size title bar; each Web surface reserves the same title band and retains its own background.
- Spacing and geometry: passed. The 280px navigation column, centered composer width, low-density empty state, subdued dividers, and rounded editor align with the reference hierarchy without copying Codex branding.
- Product identity: passed. DeepSeek Harness wordmark, whale asset, Chinese copy, workspace model, plugin surface, and existing settings remain native to DSH.
- Interaction: passed. New session, search, workspace selection, settings, composer controls, native menus, external-link handling, file selection, zoom, reload, and log access remain functional through the existing DSH client and the native shell.
- Workspace developer controls: passed. A non-blank macOS session exposes a split launcher beside the existing session utilities; its menu keeps the reference order for VS Code, Cursor, Finder, Terminal, and Workspace settings. The settings modal reports the registered path and Git state, while deterministic host tests and the assembled Web fixture cover dirty-tree refusal, branch creation, linked-worktree creation, and Workspace registration.
- Safety: passed. The compared page came from the packaged runtime behind the loopback access fence; the build smoke separately proved unauthenticated rejection and authenticated bootstrap.

## Intentional differences

The reference imagery includes Codex-only destinations, scheduled tasks, and marketing-stage gradient framing. DeepSeek Harness keeps only capabilities its native runtime currently owns and uses its established monochrome product surfaces. Application glyphs come from the repository's icon library rather than copied OpenAI or third-party assets. This avoids presenting unavailable functions or copying protected product identity while preserving the requested page format.

final result: passed
