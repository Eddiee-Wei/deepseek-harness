# Agent Note: 社区桌面身份与归属说明

Status: implemented
Archived: 2026-09-02

[English](2026-08-26-community-desktop-identity-and-attribution.md) | 中文

## 问题

社区 macOS 外壳会打包官方 DeepSeek Harness 运行时，但如果把完整的上游产品名、bundle 命名空间和 Web favicon 作为桌面 App 自身身份，就可能让用户误认为它是 DeepSeek 的官方发行版。只把上游 MIT License 放在 App 资源中，也会让用户在安装前难以找到归属说明。如果启动 `dsh web` 时不禁止常规浏览器打开行为，即使桌面展示由 WKWebView 负责，私有回环 URL 也可能出现在第二个非预期窗口中。

## 决策

本决策只覆盖[原生 macOS 桌面发行物](../feature/2026-08-17-native-macos-desktop-app.zh.md)中的可见产品名与图标选择。社区应用命名为 `DSH Desktop`。`DeepSeek Harness` 只出现在“基于 DeepSeek Harness 构建”这类描述文本中，或与内置运行时的精确版本号一起出现，而不作为外壳的独立产品名。App 使用中性的 `io.github.eddieewei.dshdesktop` bundle 标识符，并使用 macOS 构建生成的原创终端风格图标。上游包名、CLI 命令、数据目录、设置、会话格式、插件、权限和 agent 行为均保持不变。

归属说明在安装前后都可见。仓库首页标识独立分支并链接上游仓库。`apps/macos/ATTRIBUTION.txt` 声明 DSH Desktop 未获得 DeepSeek 的赞助、背书或审批，同时标识上游源码与版权所有者，并指向随包许可证文本。App 元数据与帮助菜单会展示独立名称、上游 URL 和随包说明。App 资源与 DMG 都包含 DeepSeek Harness MIT License；第三方与 Node.js 声明仍位于 App 内。

原生启动器和打包运行时冒烟测试都会传入 `--no-open`，同时保留 `127.0.0.1` 与 OS 随机端口。WKWebView 仍是该私有 origin 的唯一自动展示位置。每次启动的 token、经认证的 cookie 引导、origin 限制和非持久 WebKit 存储均保持不变。

## 考虑过的替代方案

**保留 `DeepSeek Harness` App 名称，只增加免责声明。** 未采用，因为免责声明无法消除产品名、bundle 命名空间与图标组合在用户阅读说明之前引起的来源混淆。

**删除所有 DeepSeek Harness 引用。** 未采用，因为如实标注源头、遵守许可证、确保可复现性和标识内置内核版本都需要使用上游名称。

**用桌面私有 IPC 协议取代回环 HTTP。** 未采用，因为现有经认证的回环组合已能承载原生 Harness 客户端，无需分叉传输或 agent 运行时。通过 `--no-open` 即可移除非预期的系统浏览器打开行为。

## 后果

用户可以区分社区桌面外壳与其内置上游运行时，同时仍能确认精确 Harness 版本与源码。生成的图标与中性 bundle 标识符避免复用上游 App 的视觉或命名空间身份。归属说明与许可证文本会随每个 DMG 分发，并且可通过已安装 App 访问。应用仍在已有 DSH 位置记录和存储 Harness 持有的运行时数据；只有桌面外壳日志使用 DSH Desktop 名称。维护者在修改发行打包时必须保留独立身份与这些声明。
