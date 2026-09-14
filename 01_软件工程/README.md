# 软件工程

主工程：[pottery-studio](pottery-studio/README.md)。这是我们开发的教学平台，整体迁入本分区，内部相对路径保持不变。

| 入口 | 内容 |
|---|---|
| [pottery-app](pottery-app/README.md) | 独立 Android App、iOS 工程准备、APK 打包脚本；沿用手机端原型设计 |
| [desktop](pottery-studio/desktop/package.json) | React电脑工作台 |
| [mobile](pottery-studio/mobile/package.json) | React手机浏览器端 |
| [miniprogram](pottery-studio/miniprogram/project.config.json) | 微信原生小程序，开发者工具导入此目录 |
| [core.mjs](pottery-studio/core.mjs) | 会话、模板、校准、反馈与报告 |
| [server.mjs](pottery-studio/server.mjs) | 本地共享服务与静态资源 |
| [设计验收记录](pottery-studio/design-qa.md) | 先前软件验收记录；图片保留于qa目录 |

`data/studio.json` 是用户数据，`media` 是运行素材。`node_modules`、构建后的`dist`、移动运行壳和保护文件均随工程保留，不需要因本次整理重新安装依赖。

硬件调试上位机和摄像头脚本归入 [02_硬件工程](../02_硬件工程/README.md)。它们与此处教学平台职责不同。
