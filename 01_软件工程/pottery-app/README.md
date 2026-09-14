# 非遗之手 · 安卓 App

独立安装的手机辅助端。0.2.0 重做首页、设备、练习、连接与报告的视觉层次，采用深绿、暖白和陶土色，保留原型图片与“学习 / 设备 / 我的”结构。页面资源内置于安装包；运行时连接电脑主机，不依赖微信 AppID。

## 使用方式

1. 将交付目录的 `非遗之手-0.2.0-debug.apk` 传到安卓手机安装。支持的最低系统为 Android 7.0；需可正常使用的 Android System WebView。
2. 在电脑启动项目根目录的 `启动非遗之手.cmd`，手机与电脑连接同一 Wi-Fi。
3. 电脑工作台：设置 → 两端协同 → 查看局域网地址。在 App 的“连接电脑”中填写，例如 `192.168.1.20:4180`。不要填写 `localhost`，也不要填写虚拟网卡地址。
4. 手套仍通过蓝牙连接电脑。App 的“设备”页查看连接、五指数值、校准状态和软件参考。
5. 进入练习，可开始、暂停、继续、结束并填写备注。报告保存在电脑，自动同步到手机；离线时可查看最近同步的 50 份报告。

当前版本为内部联调用 debug 签名包，未上架。安装包签名与编译通过并不等于手机真机验收；真机上的首次安装、系统分享、Wi-Fi 可达性和锁屏恢复仍需现场核验。

## 已实现与边界

| 功能 | 当前行为 |
|---|---|
| 首页与教学视频 | 内置原型图片，视频从已连接的电脑读取；无视频显示明确提示 |
| 连接电脑 | 地址校验、主机协议校验、连接持久化、自动重连、3.5 秒状态过期 |
| 五指数据 | 主机同步的数值和曲线；断线隐藏实时值，不把缓存当实时值 |
| 练习 | 共用电脑会话；开始需要实时采样；暂停、继续、结束、备注 |
| 报告 | 时长、帧数、匹配次数、匹配时间线、备注、系统分享摘要 |
| 软件参考 | 查看与新增，不覆盖手套硬件的十个槽位 |
| 校准 | 查看主机已保存的校准状态，实际端点采集仍在电脑操作 |
| 断网 | 本机缓存报告可读，写操作不可用；关闭 App 不结束电脑练习 |
| iOS | 同一套界面和 Xcode 工程已准备；未在 Windows 产出 IPA |

不包含手机直接连接手套的 BLE 驱动、账号云服务、硬件语音板协同或摄像头动捕。五指映射值不是压力/角度；参考匹配不是专业陶艺评分。外网服务和上架前应另行设计账号、访问控制、HTTPS、隐私与发布流程。APK 本身不构成备案义务的豁免依据。

## 工程目录

```text
pottery-app/
  src/App.jsx            数据同步、练习操作、返回历史与滚动恢复
  src/StudioView.jsx     各页面、固定练习控制区、可访问弹层
  src/api.js             原生 HTTP / 浏览器请求与缓存
  src/model.mjs          地址、协议、状态时效与报告规则
  src/studio.css         0.2 视觉系统、小屏布局与系统安全区
  public/art/            从原型复用的三张项目图片
  android/               可导入 Android Studio 的工程
  ios/                   iOS Xcode 工程与 Swift Package 引用
  tests/                 客户端及电脑业务契约测试
  scripts/               工具链安装、APK 编译、源码归档、隔离验收
  .toolchain/            本机 JDK / Android SDK / Gradle 缓存（不入源码包）
```

原 `pottery-studio/mobile` 保持原型预览用途，28 个受保护文件未修改；原小程序源码保留。新 App 不嵌入原型的模拟手机边框或模拟键盘。

## 重新打包

当前电脑已配置项目内的工具链，可在本目录运行：

```powershell
npm run apk
```

也可双击本目录 `打包安卓APP.cmd`。脚本构建网页、同步安卓资源、执行 `assembleDebug`、校验签名，并复制 APK 和 SHA-256 到 `../../05_交付归档/安卓APP/`。

新 Windows 电脑首次设置：

```powershell
npm ci
powershell -ExecutionPolicy Bypass -File scripts/setup-toolchain.ps1
npm run apk
```

工具链：Node.js 22+、JDK 21、Android API 36、Capacitor 8.5.2、Gradle Wrapper。安装脚本从 Adoptium 和 Google 官方源取得工具，JDK 校验供应商 SHA-256。Gradle 依赖仍需首次联网下载。构建使用临时盘符缩短 Windows 路径，退出时释放；文件仍在本工程内。不要删除本机调试签名后还期望已有安装无损升级；正式发布应使用独立、妥善备份的发布签名。

本机还遇到 Gradle 缓存目录重命名被 Windows 拒绝的问题。脚本只对已含 `metadata.bin` 和 `results.bin` 的完成缓存做复制恢复，再执行正常构建（最多五轮，有恢复进展才重试）；Gradle 仍会校验输出哈希。不修改系统防护，也不跳过编译检查。相关机制见 [Gradle 官方问题记录](https://github.com/gradle/gradle/issues/28948)。

```powershell
npm test          # 客户端与电脑核心契约测试（不修改真实数据）
npm run dev      # 浏览器预览，默认 4190
npm run sync     # 同步 Android / iOS 资源
```

安装包内不包含测试主机和合成数据。`scripts/qa-host.mjs` 仅供开发者显式启动隔离验收，监听本机 4191，不读取或写入真实的 `pottery-studio/data`。

## iOS 后续

在 Mac 安装依赖并同步后，用 Xcode 打开 `ios/App/App.xcodeproj`，设置团队签名，再选真实设备编译。局域网权限用途说明已配置；首次连接应允许访问本地网络。当前仅准备工程，未声称已编译或安装验证。参考 [Capacitor 官方环境要求](https://capacitorjs.com/docs/getting-started/environment-setup)。

原生网络采用 [Capacitor HTTP](https://capacitorjs.com/docs/apis/http)，浏览器验收使用同一业务接口。安卓 HTTP 明文仅为当前局域网联调方案提供支持；本地界面始终从安装包加载。
