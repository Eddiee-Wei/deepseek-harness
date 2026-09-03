# Agent Note: System-observed readiness in integration tests

Status: implemented

English | [中文](2026-09-03-system-observed-test-readiness.zh.md)

## Problem

Three integration tests treated a caller-side action as proof that a separate system boundary had completed. Under aggregate test contention, the Inspector test emitted a Client Console value before the browser realm processed its Console enable frame, the spill cleanup test compared a requested timestamp with the filesystem's stored timestamp, and the HMR tests depended on native watcher delivery while creating a watched path topology immediately after registration. Each assertion described valid product behavior, but its setup did not establish the state that the assertion required.

## Decision

Tests establish readiness through the system that owns the observed state:

- The Inspector Console test completes a later, side-effect-free Runtime request on the same ordered Client transport before emitting the Console value. Its response proves that the preceding Console enable frame was processed for each DevTools session.
- The spill cleanup boundary test reads the file's stored `mtimeMs` after `utimesSync` and passes that observed value as the cleanup cutoff. The test therefore verifies the strict `mtimeMs < cutoffMs` rule at a timestamp the filesystem can represent.
- HMR failure propagation starts with an existing config file so Chokidar's ready lifecycle owns the initial notification. The missing-parent acceptance uses polling because it verifies watch-root discovery across a new directory, not native filesystem event queue timing.

These changes do not add retries, widen timeouts, relax assertions, or change product behavior.

## Alternatives considered

**Increase the test timeouts.** Rejected because an event emitted before subscription or missed by a native watcher remains absent regardless of the budget.

**Repeat writes until an assertion passes.** Rejected because repeated stimuli would hide whether one causally ordered operation produces the required observation.

**Round the requested spill timestamp.** Rejected because filesystem precision varies; reading the stored metadata directly states the boundary in the filesystem's own representation.

## Consequences

The tests retain their original behavioral assertions while removing scheduling and timestamp-representation assumptions. Failures now indicate a broken ordered transport, cleanup comparison, or HMR watch-root path rather than host load or filesystem precision.
