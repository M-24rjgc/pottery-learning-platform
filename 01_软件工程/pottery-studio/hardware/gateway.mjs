import {EventEmitter} from 'node:events';
import {LineDecoder,parseGloveLine,commandSpec} from './protocol.mjs';
import {BleStreamDecoder} from './ble-stream.mjs';
export class GloveGateway extends EventEmitter{
 constructor({createPort,listPorts,now=Date.now,timeoutMs=5000}){
  super();Object.assign(this,{createPort,listPorts,now,timeoutMs});this.port=null;this.pending=null;this.logs=[];this.reset();
  this.decoder=new LineDecoder(line=>this.receive(line),()=>this.log('error','数据行过长，已丢弃'));
  this.bleDecoder=new BleStreamDecoder(bytes=>this.decoder.push(bytes),frame=>this.receiveFrame(frame),()=>this.log('error','蓝牙帧校验失败，已丢弃'));
 }
 reset(){this.info={connected:false,path:'',baudRate:9600,transport:'serial',canControl:true,canQuery:true,canSetMode:true,mode:null,lastSampleAt:null,lastTrafficAt:null,values:null,recognition:null,error:'',desynchronized:false,calibrationStage:'none',unsaved:false};this.fistValues=null;this.recentSamples=[];}
 state(){const sampleFresh=this.info.connected&&this.info.lastSampleAt!==null&&this.now()-this.info.lastSampleAt<3500;const recognitionFresh=this.info.connected&&this.info.recognition&&this.now()-this.info.recognition.at<500;return {...this.info,sampleFresh,recognition:recognitionFresh?this.info.recognition:null,busy:this.pending?.command||null,logs:this.logs.slice(-40),profile:'pottery-v2.1',continuousSamplesInRecognition:false};}
 log(kind,text){const entry={at:this.now(),kind,text};this.logs.push(entry);this.logs=this.logs.slice(-100);this.emit('log',entry);}
 async ports(){return (await this.listPorts()).map(p=>({path:p.path,transport:p.transport||'serial',manufacturer:p.manufacturer||'',serialNumber:p.serialNumber||'',vendorId:p.vendorId||'',productId:p.productId||''}));}
 async connect(portPath){
  if(this.port||this.connecting)throw Error('请先等待连接完成或断开当前设备');this.connecting=true;
  let ports;try{ports=await this.ports();}catch(e){this.connecting=false;throw e;}if(!ports.some(p=>p.path===portPath)){this.connecting=false;throw Error('设备不在设备列表中，请刷新后选择');}
  this.reset();this.decoder.reset();this.bleDecoder.reset();this.info.path=portPath;this.info.transport=portPath.startsWith('BLE:')?'ble':'serial';this.info.canControl=true;this.info.canReadTemplates=this.info.transport==='serial';this.info.baudRate=this.info.transport==='serial'?9600:null;let port;try{port=this.createPort({path:portPath,baudRate:9600,autoOpen:false});}catch(e){this.connecting=false;throw e;}this.port=port;
  port.on('data',bytes=>{if(this.port===port)(this.info.transport==='ble'?this.bleDecoder:this.decoder).push(bytes);});
  port.on('error',err=>{if(this.port===port){this.info.error=err.message;this.info.desynchronized=true;this.log('error',err.message);this.failPending(Error('设备连接异常：'+err.message));}});
  port.on('close',()=>{if(this.port===port){this.port=null;this.info.connected=false;this.info.values=null;this.info.recognition=null;this.failPending(Error('设备已断开，设备执行结果可能未知'));this.emit('disconnected');this.log('state','设备已断开');}});
  try{await new Promise((resolve,reject)=>port.open(err=>err?reject(err):resolve()));}catch(e){this.port=null;this.info.error=e.message;throw e;}finally{this.connecting=false;}
  this.info.connected=true;this.log('state',this.info.transport==='ble'?'手套蓝牙已连接，等待实时数据':`${portPath} 已打开，等待手套数据；波特率9600`);return this.state();
 }
 async disconnect(){if(this.connecting)throw Error('正在连接设备，请等待连接完成');const port=this.port;this.failPending(Error('连接已关闭，未确认的操作不能视为成功'));if(port?.isOpen)await new Promise((resolve,reject)=>port.close(e=>e?reject(e):resolve()));this.port=null;this.info.connected=false;this.info.values=null;this.info.recognition=null;this.emit('disconnected');return this.state();}
 failPending(error){if(this.pending){const p=this.pending;this.pending=null;clearTimeout(p.timer);p.reject(error);}}
 receive(line){
  const packet=parseGloveLine(line);if(!packet)return;this.info.lastTrafficAt=this.now();
  if(packet.type==='sample'){this.info.values=packet.values;this.info.lastSampleAt=this.now();this.info.mode=0;this.recentSamples.push({at:this.now(),values:[...packet.values]});this.recentSamples=this.recentSamples.slice(-8);this.emit('sample',{...packet,at:this.now()});}
  else if(packet.type==='gesture'){this.info.mode=1;this.info.recognition={...packet,at:this.now()};this.emit('gesture',this.info.recognition);}
  else if((packet.type==='mode'||packet.type==='status'))this.info.mode=packet.mode;
  else if(packet.type==='boot'){this.failPending(Error('手套重新启动，操作结果未知'));this.info.mode=0;this.info.values=null;this.info.lastSampleAt=null;this.info.recognition=null;this.fistValues=null;this.info.calibrationStage='none';this.info.unsaved=false;}
  if(packet.type!=='sample')this.log('rx',line);
  const p=this.pending;if(!p)return;if(packet.type!=='sample')p.lines.push(line);
  if(/错误:|未知命令:|EEPROM 中无有效配置|用法:/.test(line))this.failPending(Error('设备拒绝操作：'+line));
  else if(p.ack.test(line)){
   clearTimeout(p.timer);this.pending=null;
   if(p.command==='CALIB_MIN'){this.fistValues=p.before;this.recentSamples=[];this.info.calibrationStage='fist';}
   if(p.command==='CALIB_MAX'){this.info.calibrationStage='complete';this.recentSamples=[];}
   if(p.command==='CALIB_RESET'){this.fistValues=null;this.info.calibrationStage='none';}
   if(p.mutates&&!p.command.startsWith('MODE '))this.info.unsaved=true;
   if(p.command==='SAVE'||p.command==='LOAD')this.info.unsaved=false;
   if(p.command==='LOAD'){this.fistValues=null;this.info.calibrationStage='loaded';}
   p.resolve({command:p.command,status:'acknowledged',scope:p.scope||'command',reply:line,lines:p.lines,capturedValues:p.before,at:this.now()});
  }
 }
 receiveFrame({command,payload}){
  this.info.lastTrafficAt=this.now();
  if(command===3&&payload.length===1&&payload[0]<=1)this.receive('MODE:'+payload[0]);
  if((command===1&&payload.length===1&&payload[0]<=4)||(command===2&&payload.length===2&&payload[0]>=5&&payload[0]<=9&&payload[1]<=31)){
   this.info.mode=1;this.info.recognition={type:'gesture',kind:command===1?'correct':'incorrect',id:payload[0],mask:command===2?payload[1]:null,at:this.now()};this.emit('gesture',this.info.recognition);
  }
 }
 async command(input){
  const spec=commandSpec(input,{transport:this.info.transport});
  if(!this.info.connected||!this.port?.isOpen)throw Error('请先在电脑选择并连接手套设备');
  if(this.info.transport==='ble'&&!/^(?:HELP|STATUS|MODE [01]|CALIB_MIN|CALIB_MAX|SAVE|LOAD|RECORD [0-9] (?:[1-9][0-9]{0,2}|1000))$/.test(spec.text))throw Error('此无线命令不可用；完整模板读取只由USB输出');
  if(this.info.desynchronized)throw Error('上一条命令未确认，请重新连接设备并查询状态后再操作');
  if(this.pending)throw Error('设备正在执行上一条命令，请等待回执');
  if(this.info.mode===null&&!['HELP','STATUS','LIST','MODE 0'].includes(spec.text))throw Error('设备通道已打开，但尚未识别到手套数据；请先查询状态或切到采集模式0');
  if(/^(CALIB_MIN|CALIB_MAX|RECORD )/.test(spec.text)&&(this.info.mode!==0||!this.state().sampleFresh))throw Error('请切到采集模式0，等待实时数据后再操作');
  if(this.info.transport==='ble'&&/^(CALIB_MIN|CALIB_MAX|RECORD )/.test(spec.text)){
   const recent=this.recentSamples.filter(x=>this.now()-x.at<1600);
   if(recent.length<5||recent.at(-1).at-recent[0].at<700)throw Error('请保持姿态约一秒，等待稳定采样后再试');
   if([0,1,2,3,4].some(i=>Math.max(...recent.map(x=>x.values[i]))-Math.min(...recent.map(x=>x.values[i]))>60))throw Error('手指仍在移动，请保持姿态稳定约一秒后再试');
  }
  if(spec.text==='CALIB_MAX'){if(!this.fistValues)throw Error('请先采集握拳端点');if(this.info.values.some((v,i)=>Math.abs(v-this.fistValues[i])<20))throw Error('部分手指变化太小；请张开五指后重试，未发送校准命令');}
  if(spec.text.startsWith('RECORD ')){const tol=Number(spec.text.split(' ')[2]);if(this.info.values[0]-tol<=500&&this.info.values[0]+tol>=2500)throw Error('拇指容差覆盖全范围，当前固件会跳过此模板，请减小容差');}
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{this.info.desynchronized=true;this.info.error='命令回执超时，设备是否执行尚不确定';this.log('error',this.info.error);this.failPending(Error(this.info.error));},this.timeoutMs);
   this.pending={command:spec.text,ack:spec.ack,mutates:spec.mutates,scope:spec.scope,before:this.info.values?[...this.info.values]:null,lines:[],timer,resolve,reject};this.log('tx',spec.text);
   try{this.port.write(spec.text+'\n',err=>{if(err){this.info.desynchronized=true;this.failPending(Error('写入失败，执行结果未知：'+err.message));}});}catch(e){this.info.desynchronized=true;this.failPending(e);}
  });
 }
}
