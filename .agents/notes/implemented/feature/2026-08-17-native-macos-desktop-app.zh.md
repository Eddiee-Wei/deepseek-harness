# Agent Note: 基于 Web 组合的原生 macOS 桌面发行物

Status: implemented

[English](2026-08-17-native-macos-desktop-app.md) | 中文

## 问题

DeepSeek Harness 已有适合桌面编程 agent 的浏览器表层、会话与插件体验。这个社区发行早于官方跨平台桌面应用，并继续维护独立的 Swift macOS 磁盘镜像。若包装层重新实现 agent 传输，或维护经过修改的 agent loop，视觉客户端将很难持续跟进上游 Harness，也可能形成第二套权限或持久化模型。单纯启动浏览器还会让无关浏览器 origin 和误连的本机客户端访问回环上的代码执行表层。

## 决策

`apps/macos` 是现有 `dsh web` 组合之上的私有部署根与 Swift AppKit／WebKit 原生外壳。它被明确排除在 npm release member 策略之外，因为其 manifest 选择的是复制进签名 App 的依赖闭包，而不是定义可供消费的 JavaScript 包。部署根依赖官方 Python SDK 运行时载体；后者继续维护完整 Harness 运行时闭包，桌面端只补充自己的特有要求。扁平的生产部署让打包后的 ESM 插件共享一份 peer 模块图，无需在桌面层重复上游包清单。应用内置 arm64 Node.js，并使用原生 Node.js 启动已发布的 `@deepseek-ai/dsh` CLI。外壳只解析现有 `dsh web:` 就绪行，不导入 agent 内部实现，不修改 `agent-loop`，不发明会话格式，也不增加桌面专用工具协议。

上游 `apps/desktop` 与 `apps/desktop-host` 包提供官方 Electron 应用；除普通上游合并外，本发行不修改它们。社区 `apps/macos` 根继续作为独立的 Apple Silicon 发行物，使用单独的 `app:macos` 命令、发行工作流、bundle 标识符与归属说明。两个应用根都是私有 workspace member；它们都不会改变 npm 发布成员或共用 Harness 运行时语义。

外壳会在文档首次绘制前注入 `html[data-dsh-desktop='macos']`。客户端包只通过该标记为原生标题栏留白并进行少量桌面几何调整。对应的原生拖拽视图会把原始鼠标按下事件交给 `NSWindow.performDrag(with:)`；系统窗口移动因此只发生在标题栏留白区域，不依赖 WebKit 命中测试，也不会让整个窗口背景都可拖动。应用使用 DeepSeek Harness 名称与仓库自带的 Web 鱼形标记，同时按[上游可见的 macOS 品牌决策](2026-09-02-upstream-visible-macos-branding-and-resources.zh.md)保留中性 bundle 标识符和独立社区归属说明；窗口组合遵循 Codex 桌面布局：原生窗口装饰、常驻导航侧栏、对话画布、输入框和可选详情栏。

Session 区头的 Workspace 开发者控件仍属于共用 Web 客户端，而不是原生外壳。它可在四个固定 macOS 应用之一打开已注册 Workspace，并通过由 `dsh-api-workspace-controller` 持有、仅限回环地址的 Host RPC 方法展示 Git 仓库状态。创建分支会拒绝脏的当前 worktree；创建关联 worktree 会把目标目录限定在 Harness 持有的家目录下，只注册已成功创建的路径，并在其中启动普通 Session。Git 与 `open` 均通过固定可执行文件及参数数组调用，不经过 shell，也不接收调用方提供的命令字符串。这样，原生桌面操作仍位于轻量展示与 Host 集成层，不改变 agent loop、工具、权限、会话或插件语义。

每次启动都让 Web 服务器绑定 `127.0.0.1` 的 OS 随机端口。Harness Connection 服务会生成一个 256 位、URL 安全的引导 token，常规 `dsh web:` 就绪行通过外壳持有的输出管道携带其认证 URL。外壳只接受带有一个有效 token query 的 HTTP 回环根 URL，在持久化就绪行前脱敏该 token，并把认证 URL 加载进非持久化 WebView。顶层 GET query 通过匹配后，webserver 会把 token 换成仅限当前宿主、HttpOnly、SameSite=Strict 的 cookie，通过重定向移除 query，并拒绝其他所有未携带该 cookie 的 HTTP 与 upgrade 请求。token 使用常量时间比较。

WebKit 使用非持久数据存储，导航只允许当前受管的回环 origin。用户点击的外部链接交给系统浏览器。App 退出时负责子进程生命周期，先发送 SIGTERM，再用有时间上限的 SIGKILL 兜底。Developer ID 签名启用 hardened runtime；内置 Node.js 只获得其运行时与原生 addon 所需的动态代码和库校验例外。应用不启用 App Sandbox，因为 Harness 支持的工作包含经用户授权的文件系统、终端、子进程和语言服务器访问；这些权限仍由现有 Harness 策略负责。

`apps/macos/build.sh` 会读取内置 `@deepseek-ai/dsh` CLI manifest 中的精确版本号，并把 Web 文档标题构建为 `DeepSeek Harness <版本号>`，保留预发布后缀。脚本还会分别提供产品名称与版本号，让侧边栏保持简洁的产品名，并在悬停时提供 `version[-commit][-dirty]`。这样，已安装客户端的可见身份会随已同步的 Harness revision 更新，同时不需要在运行时发起网络请求。脚本会禁用生命周期脚本，以扁平模块图部署维护中的运行时闭包，再把 workspace 安装阶段生成且列入允许清单的 `fs-ext` 原生 addon 复制进部署目录。缺少该原生产物时，打包会失败。随后，脚本会运行构建产物自检以验证访问栅栏与 token 交换，编译 Swift 外壳，将仓库内的 Web 图标光栅化，从内到外为嵌套 Mach-O 文件签名，验证 App，创建并验证压缩 DMG，最后输出 SHA-256 文件。`.github/workflows/macos-release.yml` 使用固定 commit 的 action 与 Apple Silicon runner。`app-v*` tag 必须具备 Developer ID 与公证凭据，并把验证后的 DMG 和校验和发布到 GitHub Release。`test-v*` tag 强制使用 ad hoc 签名、跳过公证，并发布带有明确警告、只用于可信测试的 GitHub Pre-release。手动运行可以生成 artifact，但不会发布 Release。

## 考虑过的替代方案

**把 Web 客户端与 agent 运行时分叉到单独的桌面仓库。** 未采用，因为每次上游会话、传输、权限与插件变化都需要第二套实现和协同迁移。

**用官方 Electron 应用替换本发行物。** 这个社区发行系列不采用该方案，因为现有用户使用本文记录的 Swift／WebKit 产物、bundle 身份与 GitHub 发行工作流。官方 Electron 应用仍可通过上游维护的命令使用，本发行不会分叉或修改它。

**启动用户已经安装的 `dsh`，或首次运行时下载。** 未采用，因为 App 能否启动将取决于用户安装状态与网络，并且远端包更新可以独立于签名 DMG 改变可执行代码。

**只依赖回环绑定，不做认证。** 未采用，因为回环能阻止远端网络访问，却不能阻止无关本地页面或进程访问可预测的应用服务器。

**启用 App Sandbox。** 未采用，因为当前 Harness 产品有意支持本地子进程、终端、文件系统和语言服务器能力。通过第二套 entitlement 与书签系统限制这些能力，会改变原生 agent，而不只是完成打包。

## 后果

桌面发行物与上游保持接近：多数更新只是普通 workspace 依赖和 Web UI 变化，原生外壳继续只负责少量进程管理与渲染。产物自包含，无需用户安装 Node.js，也不会在运行时下载代码，并关闭最直接的本机回环混淆路径。开发者快捷操作只作用于 Host 已注册的 Workspace 路径，受管 worktree 目标则是确定性的，并位于源码仓库之外；增加其他编辑器必须显式修改 Host allow-list。正式发行仍有严格的 Developer ID 与公证门禁；测试 tag 通道不会削弱它，也不会把 ad hoc 签名产物包装成普通版本。代价是更大的 Apple Silicon 专用 DMG、macOS 专用构建，以及正式版本所需的 Developer ID／公证 secret 管理。首个版本不含自动更新、Intel 二进制、App Store sandbox，也不承诺任意远端部署可以把本地 token 栅栏当作认证系统。
