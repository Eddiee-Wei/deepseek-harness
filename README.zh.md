# DeepSeek Harness

[English](README.md) | 中文

本仓库将 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) agent 运行时封装为具有 Codex 风格桌面界面的原生 macOS 应用。它保留上游的 agent、会话、插件、工具、权限、设置、凭据和 skill 行为，同时增加薄 macOS 外壳、工作区导航、Git 控制、本地资源入口与 DMG 打包。

## 下载桌面应用

当前适配的 Harness 版本：**0.1.2-alpha.5**

| 平台 | 支持状态 | 下载 |
|---|---|---|
| macOS 13 或更高版本，Apple Silicon | 已提供测试预发布版 | **[下载 DMG](https://github.com/Eddiee-Wei/deepseek-harness/releases/download/test-v0.1.2-alpha.5/DeepSeek-Harness-0.1.2-alpha.5-macOS-arm64.dmg)** · [SHA-256](https://github.com/Eddiee-Wei/deepseek-harness/releases/download/test-v0.1.2-alpha.5/DeepSeek-Harness-0.1.2-alpha.5-macOS-arm64.dmg.sha256) · [发行说明](https://github.com/Eddiee-Wei/deepseek-harness/releases/tag/test-v0.1.2-alpha.5) |
| Windows | 敬请期待 | — |
| Linux | 敬请期待 | — |

当前 macOS 下载包使用 ad hoc 签名，未经 Apple 公证。打开前请使用随附的 SHA-256 文件校验下载内容。macOS 可能要求按住 Control 键点按应用、选择**打开**并确认安全提示。此构建不支持 Intel Mac。

应用以 `DeepSeek Harness.app` 的形式运行，用户无需保持浏览器窗口打开。绑定到 `127.0.0.1` 的鉴权服务是内置 Harness 运行时与应用 WebView 之间的私有内部传输，不是公开网站。

## 上游与归属

本仓库是 DeepSeek Harness 的独立社区维护 fork 与非官方社区发行版。它同步上游 Harness agent 内核，并以附加层的形式维护桌面 UI 与打包逻辑，使上游更新只需最小适配。本项目未获得 DeepSeek 的赞助、背书或审批。

DeepSeek Harness 的版权归 DeepSeek 所有（Copyright (c) 2026 DeepSeek），本仓库依 [MIT License](LICENSE) 使用。DeepSeek、DeepSeek Harness 及相关标识归各自权利人所有。应用与 DMG 中包含随包归属说明及第三方许可证声明。

## 关于 DeepSeek Harness

DeepSeek Harness（`dsh`）是由 [DeepSeek AI](https://deepseek.com) 开发的开源 agent harness（智能体框架）。

它构建于**一切皆插件**的架构之上，由 [Cordis](https://github.com/cordiverse/cordis) 驱动，其设计参见论文 [_A Programming Paradigm for Spatiotemporal Composability_](https://arxiv.org/abs/2608.25512)。

文档：[https://deepseek-harness.github.io/deepseek-harness/](https://deepseek-harness.github.io/deepseek-harness/)

## 开发者预览

DeepSeek Harness 处于 _开发者预览_ 阶段，正在快速迭代。**未来将出现破坏兼容性的变更。**

运行本项目前，请阅读[安全说明](SAFETY.zh.md)。

<a id="run"></a>

## 运行

### 通过 `npm` 运行

安装 `Node.js`，然后运行：

```sh
npx @deepseek-ai/dsh web
```

该命令默认会在 `http://127.0.0.1:3080` 启动 Web UI，本机启动时还会用默认浏览器打开页面。通过 SSH 启动时只打印宿主机 URL，因为本地转发地址由 SSH 客户端或编辑器持有。传入 `--no-open` 可仅运行服务器而不打开浏览器。详见 [Web UI 指南](docs/user/guide/index.zh.md)。

<a id="run-from-source"></a>

### 从源码运行

如需从仓库源码运行：

```sh
git clone https://github.com/Eddiee-Wei/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dsh web
```

`pnpm run build` 会准备仓库产物。`pnpm dsh web` 会直接使用这些已构建产物，不会重新构建。

## 社区与支持

- 通过 [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions) 提交反馈或 bug 报告。
- 为你的插件仓库添加 [`dsh-plugin`](https://github.com/topics/dsh-plugin) 话题，便于被发现。
- 欢迎加入 DeepSeek Harness 企微群：扫码添加企微小助手并填写入群问卷，完成后小助手会邀请你入群。

<table>
  <thead>
    <tr>
      <th align="center">企微小助手</th>
      <th align="center">入群问卷</th>
      <th align="center">微信公众号</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center"><img src="https://cdn.deepseek.com/harness/readme/community-wecom-assistant.png" alt="DeepSeek Harness 企微小助手二维码" width="180" height="180"></td>
      <td align="center"><a href="https://trtgsjkv6r.feishu.cn/share/base/form/shrcnIt5twSVdLGD52KJBckGCgg"><img src="https://cdn.deepseek.com/harness/readme/community-wecom-survey.png" alt="DeepSeek Harness 入群问卷二维码" width="180" height="180"></a></td>
      <td align="center"><img src="https://cdn.deepseek.com/harness/readme/community-wechat-official-account.png" alt="DeepSeek Harness 团队微信公众号二维码" width="180" height="180"></td>
    </tr>
  </tbody>
</table>

## 参与贡献

参见 [CONTRIBUTING.md](CONTRIBUTING.zh.md)。

## 开发

请先阅读[开发指南](docs/development.zh.md)与[架构文档](docs/architecture.zh.md)。

面向 agent：请遵循 [AGENTS.md](AGENTS.md)。

## 许可证

[MIT](LICENSE)

第三方依赖及其许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
