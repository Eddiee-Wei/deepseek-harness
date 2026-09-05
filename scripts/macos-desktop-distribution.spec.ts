import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const read = (path: string): string => readFileSync(resolve(root, path), 'utf8')

describe('macOS desktop distribution', () => {
  it('uses the repository-owned Harness identity with visible community attribution', () => {
    const build = read('apps/macos/build.sh')
    const info = read('apps/macos/Info.plist')
    const icon = read('apps/macos/Sources/IconRasterizer.swift')
    const shell = read('apps/macos/Sources/main.swift')

    expect(build).toContain('DESKTOP_CLIENT_BRAND_NAME="DeepSeek Harness"')
    expect(build).toContain('DeepSeek-Harness-$HARNESS_VERSION-macOS-arm64')
    expect(build).toContain('ATTRIBUTION.txt')
    expect(build).toContain('apps/web/public/favicon.svg')
    expect(info).toContain('<string>io.github.eddieewei.deepseek-harness</string>')
    expect(info).toContain('<string>DeepSeek Harness</string>')
    expect(info).toContain('<string>https://github.com/deepseek-ai/deepseek-harness</string>')
    expect(icon).toContain('NSImage(contentsOf: sourceURL)')
    expect(icon).not.toContain('let mark = ">_" as NSString')
    expect(shell).toContain('Open User Skills Folder')
    expect(shell).toContain('Open Local Data Folder')
    expect(shell).toContain('Open Application Resources')
  })

  it('keeps the authenticated loopback runtime inside the App instead of opening a browser', () => {
    const shell = read('apps/macos/Sources/main.swift')
    const smoke = read('apps/macos/verify-runtime.mjs')

    expect(shell).toContain('"--host", "127.0.0.1", "--port", "0", "--no-open"')
    expect(smoke).toContain("'--host', '127.0.0.1', '--port', '0', '--no-open'")
    expect(shell).toContain('configuration.websiteDataStore = .nonPersistent()')
    expect(shell).toContain('queryItems.count == 1, queryItems[0].name == "token"')
    expect(shell).toContain('with: "$1<redacted>"')
    expect(shell).not.toContain('DSH_WEB_ACCESS_TOKEN')
  })

  it('reuses the maintained Harness runtime closure with a flat packaged module graph', () => {
    const build = read('apps/macos/build.sh')
    const manifest = JSON.parse(read('apps/macos/package.json')) as {
      dependencies: Record<string, string>
    }

    expect(manifest.dependencies['dsh-python-runtime-closure']).toBe('workspace:*')
    expect(manifest.dependencies['@deepseek-ai/dsh-session-title-llm']).toBe('workspace:^')
    expect(build).toContain('--ignore-scripts')
    expect(build).toContain('--config.node-linker=hoisted')
    expect(build).toContain("require.resolve('fs-ext'")
    expect(build).toContain('build/Release/fs_ext.node')
  })
})
