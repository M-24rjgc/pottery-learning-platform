# 宣传演示环境

独立运行在本机4192（电脑）和4193（App），用合成数据驱动真实业务逻辑和界面，不接触真实设备或data目录。页面标注演示数据，不能当作实物识别或教学效果证据。

启动前在pottery-studio安装根目录及desktop依赖，在pottery-app安装依赖并执行npm run build。然后从pottery-studio运行：

```powershell
powershell -ExecutionPolicy Bypass -File demo/start.ps1
```

打开 http://localhost:4192/ 和 http://localhost:4193/ 。App连接地址填写 http://localhost:4192 。新端口有独立浏览器存储，不覆盖4190的真实主机地址。

演示自动生成一份3分钟报告（900帧、18次匹配）并启动有历史采样的示例练习；五路曲线循环变化，使用原有Studio匹配规则计算结果。允许开始、暂停、继续、结束，仅修改演示内存；硬件路由统一403。退出后演示记录消失。正常服务4180和正式App均不改为演示模式。

验证：确认两次state的数值变化，报告900帧/18次，硬件SAVE返回403；打开两端检查截图。截图来源与裁切说明见根目录04_素材资源/06_软件实拍。
