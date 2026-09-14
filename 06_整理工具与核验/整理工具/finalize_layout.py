from pathlib import Path
import json, shutil, subprocess, hashlib

ROOT=Path(__file__).resolve().parents[2]
RECORD=ROOT/'06_整理工具与核验/整理记录/2026-09-13'
EVIDENCE=ROOT/'06_整理工具与核验/审阅证据/2026-09-13'
BACKUP=RECORD/'路径更新前副本'
BACKUP.mkdir(exist_ok=True)

def update(rel, transform):
    p=ROOT/rel
    backup=BACKUP/rel
    backup.parent.mkdir(parents=True,exist_ok=True)
    if not backup.exists(): shutil.copy2(p,backup)
    old=p.read_text(encoding='utf-8-sig')
    new=transform(old)
    p.write_text(new,encoding='utf-8')
    changes.append({'file':rel,'before_sha256':hashlib.sha256(old.encode()).hexdigest(),'after_sha256':hashlib.sha256(new.encode()).hexdigest()})

changes=[]
for rel in ['01_软件工程/pottery-studio/README.md','01_软件工程/pottery-studio/design-qa.md']:
    update(rel,lambda s:s.replace('../output/design/','../../04_素材资源/04_界面原型/').replace('../pottery-assets/','../../04_素材资源/05_插画素材/'))

def report_paths(s):
    s=s.replace('整理日期：2026年9月13日。','整理日期：2026年9月13日。目录已按本日分区方案更新；分区路径以“国创开发”工作区根目录为基准。')
    s=s.replace('11个原始附件已复制到本目录的 `evidence/attachments/`，来源、文件大小和 SHA256 保存在 `evidence/attachments.json`。临时文件路径失效后仍可查阅这份本地副本。',
      '11个原始附件现按类别保存在 `03_项目文档/02_硬件原始文档/`、`04_素材资源/02_硬件演示视频/`、`04_素材资源/03_硬件说明与沟通截图/` 和 `05_交付归档/原始压缩包/`。来源、新路径、大小及 SHA256 保存在 `06_整理工具与核验/审阅证据/2026-09-13/attachments.json`，不再依赖微信临时目录。')
    s=s.replace('本目录内的 `pottery-learning-glove/` 是硬件源码快照，`evidence/` 是材料与核对记录。',
      '硬件源码位于 `02_硬件工程/pottery-learning-glove/`；下面硬件文件路径相对此仓库。软件位于 `01_软件工程/pottery-studio/`；核对记录位于 `06_整理工具与核验/审阅证据/2026-09-13/`。')
    s=s.replace('`evidence/','`06_整理工具与核验/审阅证据/2026-09-13/')
    s=s.replace('工作区 `pottery-studio/','工作区 `01_软件工程/pottery-studio/')
    return s
update('03_项目文档/03_梳理报告/硬件资料梳理与软件衔接.md',report_paths)

def media_paths(s):
    s=s.replace("ROOT=Path(__file__).resolve().parent", "TOOL_ROOT=Path(__file__).resolve().parent\nWORKSPACE=TOOL_ROOT.parents[2]\nROOT=WORKSPACE/'06_整理工具与核验/审阅证据/2026-09-13'\nROOT.mkdir(parents=True,exist_ok=True)")
    s=s.replace("str(ROOT/'tooldeps')", "str(TOOL_ROOT/'tooldeps')")
    s=s.replace("BASE=Path(r'C:\\Users\\Administrator\\Documents\\xwechat_files\\wxid_sspr3e1w92qm22_9046\\msg\\video\\2026-09')", "BASE=WORKSPACE/'04_素材资源/02_硬件演示视频'")
    s=s.replace("ROOT/'evidence'/",'ROOT/')
    s=s.replace("[FF,'-hide_banner'", "[FF,'-y','-hide_banner'")
    return s
update('06_整理工具与核验/整理工具/视频审阅/inspect_media.py',media_paths)

moves=json.loads((RECORD/'迁移日志.json').read_text(encoding='utf-8-sig'))
attachment_moves={Path(x['source'].replace('\\','/')).name:x['destination'].replace('\\','/') for x in moves if '/attachments/' in x['source'].replace('\\','/')}
def manifest_paths(s):
    items=json.loads(s)
    for item in items:
        name=Path(item['source'].replace('\\','/')).name
        item['previous_snapshot']=item['snapshot']
        item['snapshot']=attachment_moves[name]
        item['snapshot_base']='workspace root'
    return json.dumps(items,ensure_ascii=False,indent=2)+'\n'
update('06_整理工具与核验/审阅证据/2026-09-13/attachments.json',manifest_paths)
def video_paths(s):
    items=json.loads(s)
    for item in items:
        item['original_file']=item['file']
        item['file']=str(ROOT/'04_素材资源/02_硬件演示视频'/Path(item['file'].replace('\\','/')).name)
    return json.dumps(items,ensure_ascii=False,indent=2)+'\n'
update('06_整理工具与核验/审阅证据/2026-09-13/videos.json',video_paths)
(RECORD/'路径更新记录.json').write_text(json.dumps(changes,ensure_ascii=False,indent=2),encoding='utf-8')

docs={
'README.md':'''# 非遗之手项目总目录

这里集中保存陶艺教学软件、硬件源码、原始文档、设计素材和交付资料。整理日期：2026年9月13日。

先看 [硬件资料梳理与软件衔接](03_项目文档/03_梳理报告/硬件资料梳理与软件衔接.md)，或按下面分区进入。

| 分区 | 内容 | 常用入口 |
|---|---|---|
| 01_软件工程 | 我们开发的完整教学平台 | [软件说明](01_软件工程/README.md)、[运行与开发说明](01_软件工程/pottery-studio/README.md) |
| 02_硬件工程 | GitHub完整硬件仓库、原交付上位机 | [硬件代码导航](02_硬件工程/README.md) |
| 03_项目文档 | 项目计划、硬件原始Word、综合梳理 | [文档索引](03_项目文档/文档索引.md) |
| 04_素材资源 | 原始视频、硬件演示、截图、界面原型、插画 | [素材索引](04_素材资源/素材索引.md) |
| 05_交付归档 | 收到的原始RAR压缩包 | [交付归档说明](05_交付归档/README.md) |
| 06_整理工具与核验 | 视频关键帧、文字提取、来源哈希、迁移日志和工具 | [核验说明](06_整理工具与核验/README.md) |

## 主要目录

```text
国创开发/
├─ README.md
├─ 启动非遗之手.cmd
├─ 01_软件工程/
│  └─ pottery-studio/
│     ├─ desktop/       电脑工作台
│     ├─ mobile/        手机浏览器端
│     ├─ miniprogram/   微信原生小程序
│     ├─ core.mjs       业务逻辑
│     ├─ server.mjs     本地服务
│     ├─ data/          用户设置、模板、报告
│     ├─ media/         软件运行使用的视频与语音
│     └─ tests/、qa/    测试与软件验收记录
├─ 02_硬件工程/
│  ├─ pottery-learning-glove/  带.git和完整历史的GitHub仓库
│  └─ 上位机交付版/pc_tool/   从微信RAR解出的原交付版本
├─ 03_项目文档/
│  ├─ 01_项目计划/
│  ├─ 02_硬件原始文档/
│  └─ 03_梳理报告/
├─ 04_素材资源/
│  ├─ 01_原始教学与参考视频/
│  ├─ 02_硬件演示视频/
│  ├─ 03_硬件说明与沟通截图/
│  ├─ 04_界面原型/
│  └─ 05_插画素材/
├─ 05_交付归档/原始压缩包/
└─ 06_整理工具与核验/
   ├─ 审阅证据/2026-09-13/
   ├─ 整理记录/2026-09-13/
   └─ 整理工具/
```

## 使用入口

双击根目录的 `启动非遗之手.cmd` 启动软件。它进入软件正式目录并调用原来的启动器，运行需要Node.js。

电脑工作台为 http://localhost:4180 ，手机浏览器端为 http://localhost:4180/mobile/ 。微信开发者工具应导入 `01_软件工程/pottery-studio/miniprogram`；手机浏览器端与微信工程是两个不同入口。

当前硬件仓库检出master，提交为 `8ae9975b31dee99c2eea70439d73d69d056a0d62`，已获取master、main远端分支及全部可达提交历史，共10个提交。main仅为初始README；主开发内容位于master。硬件固件、摄像头程序和上位机都在本地，见硬件分区索引。

## 后续文件放置约定

软件业务改动进入01分区现有工程；硬件固件和硬件配套程序进入02分区Git仓库。原始Word和项目说明进入03；新视频、截图和设计素材按04的分类存放；新收到的原始压缩包进入05；提取结果、临时分析工具和核验日志进入06。

工程自带README、AGENTS、构建配置、依赖、data和运行素材保留在工程内部，集中索引提供导航。上位机交付版是来源留档，后续硬件开发以Git仓库内版本为准，避免两份代码分别修改。

原微信文件未改动。整理是目录迁移与文档路径更新，不代表完成了硬件接入或微信真机验证。目录迁移前后核对的332个源码/资料文件SHA256全部一致；此后文档和审阅工具的路径更新另有日志与更新前副本。依赖目录、Git内部对象和构建输出未纳入该逐文件哈希口径。
''',
'01_软件工程/README.md':'''# 软件工程

主工程：[pottery-studio](pottery-studio/README.md)。这是我们开发的教学平台，整体迁入本分区，内部相对路径保持不变。

| 入口 | 内容 |
|---|---|
| [desktop](pottery-studio/desktop/package.json) | React电脑工作台 |
| [mobile](pottery-studio/mobile/package.json) | React手机浏览器端 |
| [miniprogram](pottery-studio/miniprogram/project.config.json) | 微信原生小程序，开发者工具导入此目录 |
| [core.mjs](pottery-studio/core.mjs) | 会话、模板、校准、反馈与报告 |
| [server.mjs](pottery-studio/server.mjs) | 本地共享服务与静态资源 |
| [设计验收记录](pottery-studio/design-qa.md) | 先前软件验收记录；图片保留于qa目录 |

`data/studio.json` 是用户数据，`media` 是运行素材。`node_modules`、构建后的`dist`、移动运行壳和保护文件均随工程保留，不需要因本次整理重新安装依赖。

硬件调试上位机和摄像头脚本归入 [02_硬件工程](../02_硬件工程/README.md)。它们与此处教学平台职责不同。
''',
'02_硬件工程/README.md':'''# 硬件代码导航

主仓库：[pottery-learning-glove](pottery-learning-glove/README.md)。来源为 [zwt383/pottery-learning-glove](https://github.com/zwt383/pottery-learning-glove)，保留.git、远端配置、master/main分支和完整历史。

| 路径 | 用途 |
|---|---|
| [pottery_glove/pottery_glove.ino](pottery-learning-glove/pottery_glove/pottery_glove.ino) | 当前ATmega328P手套主程序，采样、校准、手势识别 |
| [sketch_sep9a/sketch_sep9a.ino](pottery-learning-glove/sketch_sep9a/sketch_sep9a.ino) | ESP32蓝牙中继和播报调度 |
| [STM32F103/Project.uvprojx](pottery-learning-glove/STM32F103/Project.uvprojx) | Keil工程，STM32语音协议转换 |
| [pottery_glove/pc_tool/main.py](pottery-learning-glove/pottery_glove/pc_tool/main.py) | 仓库内Python串口上位机 |
| [hand_record.py](pottery-learning-glove/hand_record.py) | PC摄像头关键点识别、录像和回放 |
| [lehand/lehand.ino](pottery-learning-glove/lehand/lehand.ino) | 旧版手套参考工程，不能当作当前陶艺固件 |
| 3.体感手套波特率修改程序/ | 原手套配置工具，位于仓库内 |
| [开发报告](pottery-learning-glove/doc/DEVELOPMENT_REPORT.md) | 随Git版本维护的技术文档 |
| [上位机交付版/pc_tool/main.py](上位机交付版/pc_tool/main.py) | 微信RAR原始解包副本，用于核对交付来源 |

两个main.py统一换行后内容一致。后续开发优先使用仓库内版本，交付副本保留原样。原始压缩包位于 [05_交付归档](../05_交付归档/README.md)。

本次已拉取代码，没有运行硬件程序或烧录。仓库不含完整原理图、BOM、语音素材和实物固件校验信息，现有源码与实物型号的差异见 [综合梳理](../03_项目文档/03_梳理报告/硬件资料梳理与软件衔接.md)。
''',
'03_项目文档/文档索引.md':'''# 项目文档索引

| 文档 | 内容 |
|---|---|
| [项目计划书](01_项目计划/项目计划书.docx) | 当前工作区原始项目计划 |
| [技术实现报告](02_硬件原始文档/技术实现报告(1).docx) | 硬件组交付Word |
| [使用说明](02_硬件原始文档/使用说明(1).docx) | 硬件操作与接线说明 |
| [更新内容](02_硬件原始文档/更新内容.docx) | 阶段性修改说明，与源码有差异 |
| [硬件资料梳理与软件衔接](03_梳理报告/硬件资料梳理与软件衔接.md) | 本次综合消化、协议核对和衔接建议 |
| [软件运行与开发说明](../01_软件工程/pottery-studio/README.md) | 软件入口、已实现内容与限制 |
| [软件设计验收记录](../01_软件工程/pottery-studio/design-qa.md) | 先前界面与流程验收 |
| [硬件仓库README](../02_硬件工程/pottery-learning-glove/README.md) | 上游项目说明，保留在Git仓库 |
| [硬件仓库开发报告](../02_硬件工程/pottery-learning-glove/doc/DEVELOPMENT_REPORT.md) | 上游Markdown技术报告 |

Word原件保持原名和内容；仓库自带文档就地保留，由此索引集中导航，避免产生多个不同步的维护版本。Word文字提取稿与视频审阅记录位于 [核验分区](../06_整理工具与核验/README.md)。
''',
'04_素材资源/素材索引.md':'''# 素材索引

| 目录 | 内容与数量 |
|---|---|
| 01_原始教学与参考视频 | 原根目录4段MP4，保留原文件名；尚未在本轮重新判定每段具体内容 |
| 02_硬件演示视频 | 新提供的3段MP4：580ef634开头为手套演示，7e1b180e开头为摄像头关键点，22925470开头为板卡与手套灯态演示 |
| 03_硬件说明与沟通截图 | 上位机标注JPG及3张微信沟通PNG |
| 04_界面原型 | 电脑工作台与小程序原型PNG、2份设计提示词 |
| 05_插画素材 | glove-fist、glove-open、pottery-hands及相关提示词 |

软件实际播放的3段lesson视频和语音保留在 `../01_软件工程/pottery-studio/media/`；打包后的public/dist中也可能包含运行资源。这些是工程运行副本，不和这里的原始素材互相替换。

36张视频关键帧、3张合图属于审阅派生资料，位于 `../06_整理工具与核验/审阅证据/2026-09-13/`。原视频未转码或改名。
''',
'05_交付归档/README.md':'''# 原始交付归档

保留收到的 [pc_tool(1).rar](原始压缩包/pc_tool(1).rar)，内容未改动。

可阅读的解包代码位于 `../02_硬件工程/上位机交付版/pc_tool/`。Word、视频和截图分别归入03和04分区，不再混放在压缩包归档中。11个外部附件的原始路径和SHA256见 `../06_整理工具与核验/审阅证据/2026-09-13/attachments.json`。

后续新交付包保留原文件名，建议按交付日期新增子目录，解包后的开发内容归入相应工程分区。
''',
'06_整理工具与核验/README.md':'''# 整理工具与核验记录

| 目录 | 内容 |
|---|---|
| 审阅证据/2026-09-13 | Word全文提取、36张视频关键帧、3张合图、视频元数据、附件来源哈希、上位机版本比较、软件解析检查 |
| 整理记录/2026-09-13 | 迁移计划、25项迁移日志、332个源码/资料文件迁移前后SHA256、路径更新日志和更新前副本 |
| 整理工具/视频审阅 | inspect_media.py和其独立tooldeps；读取04分区视频，不依赖微信临时路径 |
| 整理工具 | 本次目录整理脚本与路径更新脚本，作为过程记录 |

迁移脚本是本次布局调整的记录，已经执行；再次运行会因源目录不存在而拒绝，不能将其视为日常启动程序。日常软件启动请使用根目录启动文件。

历史核验日志里的旧路径属于当时记录；当前材料位置以attachments.json中的snapshot（相对工作区根目录）及根目录README为准。更新前副本只作审计留档，不是后续编辑入口。

核验边界：332个文件的SHA256迁移核对不包含node_modules、tooldeps、.git内部对象和dist构建产物。目录整体迁移保留这些内容；另以运行时完整性检查和HTTP资源访问验证软件路径。硬件未编译或实物验证。
'''
}
for rel,content in docs.items():
    (ROOT/rel).write_text(content,encoding='utf-8')

(ROOT/'启动非遗之手.cmd').write_bytes(b'@echo off\r\nchcp 65001 >nul\r\ncd /d "%~dp0"\r\ncall "%~dp001_\xe8\xbd\xaf\xe4\xbb\xb6\xe5\xb7\xa5\xe7\xa8\x8b\\pottery-studio\\\xe5\x90\xaf\xe5\x8a\xa8\xe9\x9d\x9e\xe9\x81\x97\xe4\xb9\x8b\xe6\x89\x8b.cmd"\r\n')
print('Updated 6 paths/manifests; wrote project navigation and 6 section indexes; root launcher created.')
