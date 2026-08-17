# Agent Note: 基于 Web 组合的原生 macOS 桌面发行物

Status: implemented

[English](2026-08-17-native-macos-desktop-app.md) | 中文

## 问题

DeepSeek Harness 已有适合桌面编程 agent 的浏览器表层、会话与插件体验，但没有自包含的 macOS App 或签名磁盘镜像。若包装层重新实现 agent 传输，或维护经过修改的 agent loop，视觉客户端将很难持续跟进上游 Harness，也可能形成第二套权限或持久化模型。单纯启动浏览器还会让无关浏览器 origin 和误连的本机客户端访问回环上的代码执行表层。

## 决策

`apps/macos` 是现有 `dsh web` 组合之上的私有部署根与 Swift AppKit／WebKit 原生外壳。它被明确排除在 npm release member 策略之外，因为其 manifest 描述的是复制进签名 App 的依赖闭包，而不是可供消费的 JavaScript 包。应用部署生产 workspace 包，内置 arm64 Node.js，并使用原生 Node.js 启动已发布的 `@deepseek-ai/dsh` CLI。外壳只解析现有 `dsh web:` 就绪行，不导入 agent 内部实现，不修改 `agent-loop`，不发明会话格式，也不增加桌面专用工具协议。

外壳会在文档首次绘制前注入 `html[data-dsh-desktop='macos']`。客户端包只通过该标记为原生标题栏留白并进行少量桌面几何调整。可见产品身份仍是 DeepSeek Harness，窗口组合则遵循 Codex 桌面布局：原生窗口装饰、常驻导航侧栏、对话画布、输入框和可选详情栏。

每次启动都让 Web 服务器绑定 `127.0.0.1` 的 OS 随机端口，并生成一个 256 位、URL 安全的引导 token。`DSH_WEB_ACCESS_TOKEN` 通过子进程环境携带 token，不增加公开 CLI 参数，也不进入进程参数。顶层 GET query 通过匹配后，webserver 会把 token 换成仅限当前宿主、HttpOnly、SameSite=Strict 的 cookie，通过重定向移除 query，并拒绝其他所有未携带该 cookie 的 HTTP 与 upgrade 请求。token 使用常量时间比较。未配置 token 的 Web 组合保持此前的无认证行为。

WebKit 使用非持久数据存储，导航只允许当前受管的回环 origin。用户点击的外部链接交给系统浏览器。App 退出时负责子进程生命周期，先发送 SIGTERM，再用有时间上限的 SIGKILL 兜底。Developer ID 签名启用 hardened runtime；内置 Node.js 只获得其运行时与原生 addon 所需的动态代码和库校验例外。应用不启用 App Sandbox，因为 Harness 支持的工作包含经用户授权的文件系统、终端、子进程和语言服务器访问；这些权限仍由现有 Harness 策略负责。

`apps/macos/build.sh` 部署运行时，运行构建产物自检以验证访问栅栏，编译外壳，从内到外为嵌套 Mach-O 文件签名，验证 App，创建并验证压缩 DMG，最后输出 SHA-256 文件。`.github/workflows/macos-release.yml` 使用固定 commit 的 action 与 Apple Silicon runner。`app-v*` tag 必须具备 Developer ID 与公证凭据，并把验证后的 DMG 和校验和发布到 GitHub Release。手动运行可以生成 ad hoc 签名 artifact，但不会发布 Release。

## 考虑过的替代方案

**把 Web 客户端与 agent 运行时分叉到单独的桌面仓库。** 未采用，因为每次上游会话、传输、权限与插件变化都需要第二套实现和协同迁移。

**使用带私有 IPC 传输的 Electron。** 首个版本未采用，因为仓库已经拥有完整的 HTTP／WebSocket Web 组合；Electron 会再内置一个浏览器运行时，并保留当前 Web 包已经不需要的历史 file／IPC 分支。未来若需要跨平台，可以在不改变 DSH 运行时接缝的前提下重新评估。

**启动用户已经安装的 `dsh`，或首次运行时下载。** 未采用，因为 App 能否启动将取决于用户安装状态与网络，并且远端包更新可以独立于签名 DMG 改变可执行代码。

**只依赖回环绑定，不做认证。** 未采用，因为回环能阻止远端网络访问，却不能阻止无关本地页面或进程访问可预测的应用服务器。

**启用 App Sandbox。** 未采用，因为当前 Harness 产品有意支持本地子进程、终端、文件系统和语言服务器能力。通过第二套 entitlement 与书签系统限制这些能力，会改变原生 agent，而不只是完成打包。

## 后果

桌面发行物与上游保持接近：多数更新只是普通 workspace 依赖和 Web UI 变化，原生外壳继续只负责少量进程管理与渲染。签名产物自包含，无需用户安装 Node.js，也不会在运行时下载代码，并关闭最直接的本机回环混淆路径。代价是更大的 Apple Silicon 专用 DMG、macOS 专用构建，以及 Developer ID／公证 secret 管理。首个版本不含自动更新、Intel 二进制、App Store sandbox，也不承诺任意远端部署可以把本地 token 栅栏当作认证系统。
