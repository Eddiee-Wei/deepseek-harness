/**
 * Host-native command execution and path-opening utilities.
 * @module @deepseek-ai/dsh-native-command
 */

export { runNativeCommand } from './runner.ts'
export type { NativeCommandRunner } from './runner.ts'
export {
  canOpenNativePath,
  openNativePath,
  openNativePathInApplication,
  openNativeTextFile,
} from './path-opener.ts'
export type {
  PathOpenerInternals,
  PathOpenerRunner,
  NativePathApplication,
} from './path-opener.ts'
