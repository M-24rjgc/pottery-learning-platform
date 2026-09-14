const {Studio}=require('../../utils/core');const ble=require('../../utils/bridge');
const fmt=s=>Math.floor((s||0)/60).toString().padStart(2,'0')+':'+Math.floor((s||0)%60).toString().padStart(2,'0');
const titles={home:'非遗之手',device:'我的设备',calibrate:'手套校准',training:'动作练习',report:'学习报告',history:'我的学习',gestures:'手势管理',settings:'设置'};
Page({
 data:{page:'home',s:{device:{},settings:{},reports:[],templates:[]},fingers:[],elapsed:'00:00',busy:false,video:0,report:null,form:{},gestureName:'',gestureKind:'correct',devices:[],showDevices:false,serverURL:'',usingHost:false,week:[]},
 onLoad(){this.engine=new Studio(wx.getStorageSync('pottery-data')||undefined);this.base=wx.getStorageSync('pottery-server')||'';this.setData({serverURL:this.base});this.refresh();},
 onShow(){this.timer=setInterval(()=>this.refresh(),700);},onHide(){clearInterval(this.timer);},onUnload(){clearInterval(this.timer);ble.disconnect().catch(()=>{});},
 async remote(path,body){return new Promise((resolve,reject)=>wx.request({url:this.base+path,method:body?'POST':'GET',data:body,header:{'content-type':'application/json'},success:r=>r.statusCode===200?resolve(r.data):reject(Error(r.data.error||'操作失败')),fail:()=>reject(Error('无法连接工作台，请检查服务地址'))}));},
 async refresh(){if(this.polling)return;this.polling=true;try{const s=this.base?await this.remote('/api/state?client=mobile'):this.engine.state();if(s.settings.voice && s.session && !s.session.paused && s.feedback.kind === 'match' && this.lastFeedback !== 'match'){if(!this.audio)this.audio=wx.createInnerAudioContext();this.audio.src='/assets/pose-match.mp3';this.audio.play();}this.lastFeedback=s.feedback.kind;const fingers=['拇指','食指','中指','无名指','小指'].map((name,i)=>({name,value:s.device.connected?s.device.values[i]:'—',percent:s.device.connected?Math.min(100,s.device.values[i]/30):0}));const reports=s.reports.map(r=>({...r,displayDate:new Date(r.startedAt).toLocaleDateString(),displayDuration:fmt(r.duration)}));const week=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);const count=s.reports.filter(r=>new Date(r.startedAt).toDateString()===d.toDateString()).length;return {day:'日一二三四五六'[d.getDay()],height:Math.max(4,Math.min(100,count*24))};});this.setData({s:{...s,reports},fingers,elapsed:fmt(s.session&&s.session.elapsed),week,usingHost:!!this.base});}catch(e){if(!this.lastError||Date.now()-this.lastError>15000){this.tip(e.message);this.lastError=Date.now();}}finally{this.polling=false;}},
 tip(title){wx.showToast({title,icon:'none',duration:2500});},
 async action(type,payload={}){if(this.base)return this.remote('/api/action',{type,payload});const result=this.engine.action(type,payload);wx.setStorageSync('pottery-data',this.engine.data);return result;},
 async perform(fn){if(this.data.busy)return;this.setData({busy:true});try{await fn();await this.refresh();}catch(e){this.tip(e.message);}finally{this.setData({busy:false});}},
 navigate(e){this.go(e.currentTarget.dataset.page);},go(page){this.setData({page});wx.setNavigationBarTitle({title:titles[page]||'非遗之手'});},
 start(){this.perform(async()=>{if(!this.data.s.session)await this.action('start');this.go('training');});},
 pause(){this.perform(()=>this.action(this.data.s.session.paused?'resume':'pause'));},
 finish(){this.perform(async()=>{const r=await this.action('finish');this.showReport(r);});},
 showReport(r){this.setData({report:{...r,displayDuration:fmt(r.duration),displayDate:new Date(r.startedAt).toLocaleDateString()}});this.go('report');},
 reportTap(e){this.showReport(this.data.s.reports.find(r=>r.id===e.currentTarget.dataset.id));},
 setVideo(e){this.setData({video:Number(e.currentTarget.dataset.index)});},
 calibration(){this.perform(()=>this.action('calibrate',{step:this.data.s.calibration&&this.data.s.calibration.fist&&!this.data.s.calibration.completed?'open':'fist'}));},
 resetCalibration(){this.perform(()=>this.action('calibrate',{step:'fist'}));},
 voice(){this.perform(()=>this.action('settings',{voice:!this.data.s.settings.voice}));},
 settings(){this.setData({form:{...this.data.s.settings},serverURL:this.base});this.go('settings');},
 input(e){this.setData({['form.'+e.currentTarget.dataset.key]:e.detail.value});},serverInput(e){this.setData({serverURL:e.detail.value});},
 saveSettings(){this.perform(async()=>{const url=this.data.serverURL.trim().replace(/\/$/,'');if(url&&!/^https?:\/\//.test(url))throw Error('请输入完整的工作台服务地址');const old=this.base;this.base=url;try{await this.action('settings',this.data.form);}catch(e){this.base=old;throw e;}wx.setStorageSync('pottery-server',url);this.tip('设置已保存');});},
 connect(){this.perform(async()=>{if(this.base){await this.refresh();this.tip(this.data.s.hardware&&this.data.s.hardware.connected?'电脑手套已连接':'请先在电脑工作台连接手套');return;}const c=this.data.s.settings;if(!c.serviceUUID||!c.notifyUUID){this.settings();throw Error('请填写蓝牙服务与通知特征 UUID');}const devices=await ble.scan();if(!devices.length)throw Error('未发现设备，请开启手套后重试');this.setData({devices,showDevices:true});});},
 selectDevice(e){this.perform(async()=>{const d=this.data.devices[e.currentTarget.dataset.index];this.setData({showDevices:false});await ble.connect(d,this.data.s.settings,values=>{if(this.base)this.remote('/api/sample',{values,name:d.name||'陶艺手套',source:'ble'}).catch(()=>{});else this.engine.ingest(values,d.name||'陶艺手套','ble');},()=>{this.action('disconnect').catch(()=>{});this.tip('手套已断开');});this.tip('已连接，等待数据');});},
 hardwareCommand(e){this.perform(async()=>{if(!this.base)throw Error('请先设置电脑工作台服务地址');const r=await this.remote('/api/hardware/command',{command:e.currentTarget.dataset.command});this.tip('设备已确认：'+r.reply);});},
 closeDevices(){this.setData({showDevices:false});},disconnect(){this.perform(async()=>{if(this.base)await this.remote('/api/hardware/disconnect',{});else await ble.disconnect();await this.action('disconnect');});},
 gestureInput(e){this.setData({gestureName:e.detail.value});},gestureKind(e){this.setData({gestureKind:e.currentTarget.dataset.kind});},
 recordGesture(){this.perform(async()=>{await this.action('template',{name:this.data.gestureName,kind:this.data.gestureKind,tolerance:this.data.s.settings.tolerance});this.setData({gestureName:''});this.tip('参考手势已保存');});}
});

