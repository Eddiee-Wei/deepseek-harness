# DeepSeek Harness macOS 版

[English](README.md) | 中文

本目录负责 Apple Silicon 桌面发行物。它是在现有 `dsh web` 组合之上增加的展示与打包层：Swift AppKit／WebKit 外壳启动内置 Node.js 和 `@deepseek-ai/dsh` CLI，再渲染现有 Web 客户端。Agent、会话、插件、工具、权限、设置和凭据行为仍由 DeepSeek Harness 原有包负责。外壳不分叉 `agent-loop`，也不维护私有 agent 协议，因此日常跟进上游更新通常只需要重新构建应用并处理普通依赖变化。

窗口在保留 DeepSeek Harness 品牌与能力的前提下对齐 Codex 桌面页面格式：紧凑的原生标题栏、常驻的左侧工作区／会话导航、克制的对话画布、居中的输入框，以及现有详情／评审栏。外壳只注入 `html[data-dsh-desktop='macos']`；客户端 CSS 通过这个标记为原生标题栏留白并调整桌面几何，等高的透明 AppKit 拖拽区域负责原生窗口移动。浏览器部署保持原有展示。

## 本地构建

首个版本面向 Apple Silicon 上的 macOS 13 或更高版本，需要 arm64 Node.js、Xcode Command Line Tools，以及已经安装依赖的 workspace。

```sh
pnpm run app:macos
pnpm run app:macos:dmg
```

App 和 DMG 输出到 `.artifacts/macos/`。构建过程会把生产 workspace 包部署进 App，复制当前 arm64 Node.js，使用内置的原生 Node.js 启动部署后的 CLI 并验证本机访问栅栏，编译 Swift 外壳，为所有 Mach-O 依赖签名，验证 App 签名，创建并验证 DMG，最后写入 SHA-256 文件。除非 `APPLE_SIGNING_IDENTITY` 指向 Developer ID Application 证书，本地构建使用 ad hoc 签名。

## 发布

`.github/workflows/macos-release.yml` 在 Apple Silicon GitHub runner 上构建。创建正式签名版本前，需要配置以下仓库 secrets：

- `APPLE_CERTIFICATE_P12_BASE64`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY`
- `APPLE_ID`
- `APPLE_TEAM_ID`
- `APPLE_APP_PASSWORD`

推送 `app-v0.1.0` 这类 tag 后，工作流会构建、Developer ID 签名、公证、装订、验证，并把 DMG 与 SHA-256 文件发布到 GitHub Release。缺少任一 Apple 凭据时，工作流会拒绝发布这类正式版本。

没有 Apple 凭据时，可以推送 `test-v0.1.0` 这类 tag，发布带有明确标识的 GitHub Pre-release。即使仓库以后配置了 secrets，这类测试 DMG 也会强制使用 ad hoc 签名且不进行公证。Release 会提示 macOS 可能阻止常规安装、产物只适合可信测试，并要求用户在打开前核对随附的 SHA-256 文件。手动运行工作流只生成 artifact，不发布 Release；缺少凭据时使用 ad hoc 签名。

## 安全与所有权

外壳只绑定 `127.0.0.1` 的 OS 随机端口，并在每次启动时生成新的 256 位访问 token。token 通过子进程环境而不是进程参数传递，只用于换取一次仅限当前宿主、HttpOnly、SameSite 的 cookie，随后从导航 URL 移除。没有 cookie 的 HTTP 与 WebSocket 请求都会被拒绝。WebKit 使用非持久数据存储，导航只允许访问当前受管的回环 origin；用户点击的外部链接交给默认浏览器；退出 App 时会终止它负责的 DSH 服务。

App 使用 hardened runtime 签名，但有意不启用 App Sandbox：原生 DeepSeek Harness 工具需要在用户授权后访问本地工作区、子进程、终端和语言服务器。现有 Harness 权限与文件系统策略仍是权威规则。运行日志位于 `~/Library/Logs/DeepSeek Harness/runtime.log`；普通 DSH 设置、会话、凭据和插件继续使用原有位置。首个版本不包含自动更新、Intel 支持或 Mac App Store 发行。
