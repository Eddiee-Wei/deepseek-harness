# Agent Note: macOS 发行物的精确 Harness 身份

Status: implemented

[English](2026-08-26-exact-macos-harness-release-identity.md) | 中文

## 问题

原生 macOS 发行物会打包已同步的 DeepSeek Harness 运行时，但如果 App tag 删除了 Harness 预发布后缀，它标识的内核代码就可能与 DMG 实际内容不同。固定产物文件名也会让下载后的测试构建难以区分。这样会削弱发行复核能力，也无法只凭 App 版本复现其 agent 运行时。

## 决策

`apps/cli/package.json` 中的精确版本是 macOS 发行身份，并与 macOS 要求的纯数字 `CFBundleShortVersionString` 分开。每个 `test-v*` 与 `app-v*` tag 的后缀都必须等于该精确版本，包括预发布后缀；否则 `.github/workflows/macos-release.yml` 会在打包前拒绝运行。稳定版 `app-v*` tag 使用 Developer ID 与公证通道；Harness 预发布版本使用 `test-v*`，其 ad hoc 签名 GitHub Pre-release 继续明确标识为不适合常规分发。

`apps/macos/package.json` 属于 `dsh` 发行家族，并与 CLI 及被打包的 workspace 使用同一个精确版本。发行家族检查和安装布局检查会在 macOS 工作流发布产物前拒绝任何版本漂移。

`apps/macos/build.sh` 会独立比较请求的发行版本与内置 CLI manifest。App 元数据记录精确 Harness 版本与完整 Git 源码 revision。DMG 文件名、workflow artifact、GitHub Release 名称和校验和文件名都包含同一个 Harness 版本。这些字段补充[原生 macOS 桌面发行物](../feature/2026-08-17-native-macos-desktop-app.zh.md)持有的自包含运行时与安全规则，不会创建第二套 agent 版本或更新通道。

## 考虑过的替代方案

**为 UI 外壳设置独立公开版本。** 未采用，因为用户和维护者将需要另一张兼容性表，才能判断桌面发行物包含哪个 Harness 内核。

**从所有 App tag 中删除预发布后缀。** 未采用，因为多个 release candidate 可能共享同一个可见发行身份，却包含不同 agent 代码。

**在 App 启动时下载最新 Harness 运行时。** 未采用，因为签名 DMG 将无法决定实际执行的代码，启动也会依赖网络与 registry 状态。

## 后果

每个已发布 macOS 产物都会标识一个 Harness 内核版本和一个源码 revision。新的上游 Harness 版本需要同步发行 manifest，并创建新的对应 App tag；错误的 manifest 或过期 tag 会在签名与发布前失败。稳定版与预发布通道保持分离，但两者的名称都使用精确内核版本。上游合并后，发行工作流不会自动发布；匹配的 tag 仍是一次显式发行决定。
