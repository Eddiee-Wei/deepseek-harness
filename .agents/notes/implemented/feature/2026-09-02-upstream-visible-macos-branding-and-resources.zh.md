# Agent Note: 上游可见的 macOS 品牌与本地资源

Status: implemented

[English](2026-09-02-upstream-visible-macos-branding-and-resources.md) | 中文

## 问题

macOS 发行版展示的是上游 DeepSeek Harness 运行时，但独立的 `DSH Desktop` 名称和终端风格图标遮蔽了这一关系，也没有直接入口可到达 skill 根目录、本地 Harness 数据或随包声明。在产品名旁显示构建徽标会挤占主导航行，而完全省略构建标识又会让已安装的测试产物难以辨认。

## 决策

社区 macOS 发行版在应用、窗口、Web 文档、侧边栏、DMG 和产物名称中统一使用 `DeepSeek Harness`，并将仓库自带的 Web 鱼形标记光栅化为 macOS 图标。它使用由贡献者持有的 `io.github.eddieewei.deepseek-harness` bundle 标识符，并在 App 元数据、“关于”面板、“帮助”菜单、DMG 和仓库文档中显示独立社区归属说明。这个命名选择用于描述随包内置的上游运行时，并不声称获得 DeepSeek 的赞助、背书或审批。

带产品品牌的侧边栏构建只显示单行名称，并在鼠标悬停提示中提供 `version[-commit][-dirty]`。通用 Web 构建仍会在本地化的本地构建标签下方以徽标显示同一个构建标识。原生“关于”面板也会显示随包 Harness 版本、源码 revision 和社区构建状态。

标准预设仍是唯一的 skill 集成。它们会从当前 Workspace 以及既有的 `.dsh/skills`、`.agents/skills`、`~/.dsh/skills` 和 `~/.agents/skills` 根目录加载 skills。桌面外壳不会引入私有目录或协议。“帮助”菜单会打开用户 skill 根目录、Harness 数据根目录、随包资源、归属说明和运行日志；插件列表与 Workspace／Git 控制仍由“设置”页面持有。

仓库首页会标识当前适配的 Harness 版本和桌面平台支持状态。只有经过测试的发行产物存在时，平台才会标记为可用；首页会链接带版本号的 DMG、校验文件和 GitHub Release，并在下载入口旁说明签名与公证限制。

## 考虑过的替代方案

**保留 `DSH Desktop` 并增加更大的副标题。** 未采用，因为已安装应用、Dock 项和侧边栏仍会遮蔽用户实际选择的运行时。

**复制或重新绘制相似的鱼形图标。** 未采用，因为仓库已经包含精确源资源；衍生图标会降低一致性并使归属说明更复杂。

**创建桌面端专用 skill 管理器。** 未采用，因为这会重复 Harness 文件系统提供方与加载器、拆分资源归属，并增加薄外壳的更新成本。

## 后果

安装后的 App、仓库首页与发行产物可以立即识别为 DeepSeek Harness，而中性 bundle 标识符和随包声明仍会把这个社区发行版与官方厂商发行版区分开。用户可以找到当前受支持的下载，无需承受常驻徽标的视觉干扰也能检查精确适配构建，并通过原生菜单到达 skill、数据、资源、归属说明和日志位置。后续同步上游时仍只需更新一套共享的 agent、插件、权限、会话和 skill 实现，而不是维护桌面分叉。
