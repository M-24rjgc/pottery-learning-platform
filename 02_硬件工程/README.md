# 硬件代码导航

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
