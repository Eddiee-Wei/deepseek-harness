# DeepSeek Harness macOS 版

[English](README.md) | 中文

本目录负责 DeepSeek Harness 的独立社区 Apple Silicon 发行版。它是在现有 `dsh web` 组合之上增加的展示与打包层：Swift AppKit／WebKit 外壳启动内置 Node.js 和 `@deepseek-ai/dsh` CLI，再渲染现有 Web 客户端。它的私有部署根复用官方 Python SDK 载体维护的运行时闭包，只补充桌面端特有要求。Agent、会话、插件、工具、权限、设置和凭据行为仍由 DeepSeek Harness 原有包负责。外壳不分叉 `agent-loop`，也不维护私有 agent 协议，因此日常跟进上游更新通常只需要重新构建应用并处理普通依赖变化。

窗口使用 DeepSeek Harness 名称与上游 Web 客户端仓库内置的鱼形图标，同时对齐 Codex 桌面页面格式：紧凑的原生标题栏、常驻的左侧工作区／会话导航、克制的对话画布、居中的输入框，以及现有详情／评审栏。鼠标悬停在展开的侧边栏品牌区域时，会显示内置 Harness 的精确版本与源码 revision；“关于”面板会同时标识这是独立社区发行版。外壳只注入 `html[data-dsh-desktop='macos']`；客户端 CSS 通过这个标记为原生标题栏留白并调整桌面几何。等高的透明 AppKit 视图会把单次鼠标按下事件交给 `NSWindow.performDrag(with:)`，因此拖动顶部区域会移动原生窗口，同时不会把 Web 内容变成拖拽目标；双击该区域则执行窗口的原生缩放动作。浏览器部署保持原有展示。

非空白 macOS 会话会在会话标题栏提供紧凑的工作区启动器。它可以在 Visual Studio Code、Cursor、Finder 或终端中打开已注册工作区，并提供仓库设置，用于查看 Git 状态、创建并切换到新分支，或在新分支上创建关联工作树。浏览器只发送已注册的工作区 ID；Host 解析规范路径，并以固定参数、无 shell 的方式启动原生 `open` 和 `git` 进程。创建分支或工作树会拒绝脏仓库及已存在的分支名；关联工作树创建在 DSH 私有主目录下，并通过常规工作区服务注册。

## 本地构建

首个版本面向 Apple Silicon 上的 macOS 13 或更高版本，需要 arm64 Node.js、Xcode Command Line Tools，以及已经安装依赖的 workspace。

```sh
pnpm run app:macos
pnpm run app:macos:dmg
```

App 和带版本号的 `DeepSeek-Harness-<Harness 版本>-macOS-arm64.dmg` 输出到 `.artifacts/macos/`。构建过程会把桌面文档与展开的侧边栏标识为 `DeepSeek Harness`，通过悬停提示提供 `@deepseek-ai/dsh` 的精确版本号，并把该版本、完整源码 revision 和上游 URL 写入 App 元数据。它会把维护中的生产运行时闭包以扁平模块图部署进 App，复制当前 arm64 Node.js，使用内置的原生 Node.js 启动部署后的 CLI 并验证本机访问栅栏，编译 Swift 外壳，将 Web 客户端仓库内置的鱼形图标光栅化，为所有 Mach-O 依赖签名，验证 App 签名，创建并验证 DMG，最后写入 SHA-256 文件。可以把 `.app` 复制到 `/Applications`，也可以通过 DMG 安装。除非 `APPLE_SIGNING_IDENTITY` 指向 Developer ID Application 证书，本地构建使用 ad hoc 签名。

标准 Agent 预设会启用本地文件系统 skill 提供方与 skill 加载器。在输入框中键入 `/`，即可列出当前 Workspace 的 `.dsh/skills`、`.agents/skills` 以及用户目录中的 `~/.dsh/skills`、`~/.agents/skills` 所提供的 skills；App 不会用桌面端私有 skill 商店替换该目录。设置页面会展示实时插件列表与 Workspace／Git 控制。帮助菜单可以在 Finder 中打开用户 skill 目录、Harness 数据目录、App 随包资源、归属说明和运行日志。

## 发布

`.github/workflows/macos-release.yml` 在 Apple Silicon GitHub runner 上构建。创建正式签名版本前，需要配置以下仓库 secrets：

- `APPLE_CERTIFICATE_P12_BASE64`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY`
- `APPLE_ID`
- `APPLE_TEAM_ID`
- `APPLE_APP_PASSWORD`

每个发行 tag 的后缀都必须与 `apps/cli/package.json` 中的精确版本一致；工作流会在打包前拒绝不匹配的 tag。对于稳定版 Harness，推送 `app-v0.1.1` 这类 tag 后，工作流会构建、Developer ID 签名、公证、装订、验证，并把带版本号的 DMG 与 SHA-256 文件发布到 GitHub Release。此通道拒绝预发布 Harness 版本；缺少任一 Apple 凭据时，工作流也会拒绝发布。

对于 Harness 预发布版本，或没有 Apple 凭据时，可以推送 `test-v0.1.3-alpha.2` 这类 tag，发布 GitHub Pre-release；Release 名称与文件名都会携带同一个精确 Harness 版本和社区构建提示。即使仓库以后配置了 secrets，这类测试 DMG 也会强制使用 ad hoc 签名且不进行公证。Release 会提示 macOS 可能阻止常规安装、产物只适合可信测试，并要求用户在打开前核对随附的 SHA-256 文件。手动运行工作流会构建 checkout 中的精确 Harness 版本，但不发布 Release；缺少凭据时使用 ad hoc 签名。

## 归属说明

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的这一 macOS 发行版由社区独立维护，未获得 DeepSeek 的赞助、背书或审批。仓库首页、App 元数据与帮助菜单、App 资源和 DMG 都会标识上游项目并收录其 MIT License。`ATTRIBUTION.txt` 是随包归属说明，`DEEPSEEK_HARNESS_LICENSE`、`THIRD_PARTY_NOTICES.md` 和 `NODE_LICENSE` 则收录对应的许可证文本。DeepSeek、DeepSeek Harness 及相关标识归各自权利人所有。

## 安全与所有权

外壳只绑定 `127.0.0.1` 的 OS 随机端口。内置 Harness 运行时会在每次启动时生成新的 256 位访问 token，并通过外壳持有的就绪管道报告认证 URL。外壳会校验该 URL、从运行日志中脱敏 token，并且只在内置 WebView 中加载它。这个回环服务器是 WebView 与内置 Harness 运行时之间的私有传输通道，不是可从远端访问的服务。token 只用于换取一次仅限当前宿主、HttpOnly、SameSite 的 cookie，随后从导航 URL 移除；没有 cookie 的 HTTP 与 WebSocket 请求都会被拒绝。原生启动器和打包冒烟测试都会传入 `--no-open`，因此不会在用户的默认浏览器中打开这个私有 URL。WebKit 使用非持久数据存储，导航只允许访问当前受管的回环 origin；用户点击的外部链接交给默认浏览器；退出 App 时会终止它负责的 DSH 服务。

App 使用 hardened runtime 签名，但有意不启用 App Sandbox：原生 DeepSeek Harness 工具需要在用户授权后访问本地工作区、子进程、终端和语言服务器。现有 Harness 权限与文件系统策略仍是权威规则。运行日志位于 `~/Library/Logs/DeepSeek Harness/runtime.log`；普通 DSH 设置、会话、凭据、插件和 skills 继续使用原有位置。首个版本不包含自动更新、Intel 支持或 Mac App Store 发行。
