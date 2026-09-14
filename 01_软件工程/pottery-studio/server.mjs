import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {Studio,emptyData} from './core.mjs';
import {SerialPort} from 'serialport';
import {GloveGateway} from './hardware/gateway.mjs';
import {SessionCapture} from './hardware/capture.mjs';
import {BlePort,scanBlePorts} from './hardware/ble-port.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const dataDir=path.join(root,'data');fs.mkdirSync(dataDir,{recursive:true});const dataFile=path.join(dataDir,'studio.json');
let data=emptyData();if(fs.existsSync(dataFile)){try{data=JSON.parse(fs.readFileSync(dataFile,'utf8'));}catch{console.error('记录文件无法读取，启动已停止以保护原文件');process.exit(1);}}
const studio=new Studio(data);const persist=()=>{const temp=dataFile+'.tmp';fs.writeFileSync(temp,JSON.stringify(studio.data,null,2));fs.renameSync(temp,dataFile);};
let blePorts=[];let scanning=false;
const gateway=new GloveGateway({createPort:options=>options.path.startsWith('BLE:')?new BlePort(options):new SerialPort(options),listPorts:async()=>[...await SerialPort.list(),...blePorts]});
const capture=new SessionCapture(path.join(dataDir,'sessions'));
function record(event){if(studio.session){try{studio.session.rawLog=capture.append(studio.session.id,{...event,receivedAt:Date.now()});}catch(e){studio.session.captureError=e.message;console.error('原始记录保存失败:',e.message);}}}
gateway.on('sample',sample=>{try{studio.ingest(sample.values,gateway.info.transport==='ble'?'Glove 蓝牙手套':'手套 '+gateway.info.path,gateway.info.transport);if(studio.session&&!studio.session.paused)record({type:'sample',source:gateway.info.transport==='ble'?'hardware-ble':'hardware-usb',values:sample.values});}catch(e){gateway.log('error',e.message);}});
gateway.on('gesture',event=>{if(studio.session&&!studio.session.paused){studio.session.hardwareEventCount=(studio.session.hardwareEventCount||0)+1;record({type:'hardware-gesture',event});}});
gateway.on('log',entry=>record({type:'device-log',entry}));
gateway.on('disconnected',()=>{if(['serial','ble'].includes(studio.device.source))studio.action('disconnect');});
const currentState=()=>({...studio.state(),hardware:gateway.state()});
const PORT=Number(process.env.PORT||4180);
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.mp4':'video/mp4','.woff2':'font/woff2','.json':'application/json'};
function staticFile(req,res,file){
 if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('Not found');return;}
 const stat=fs.statSync(file),headers={'Content-Type':mime[path.extname(file)]||'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'no-cache'};
 const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);if(range){const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),stat.size-1):stat.size-1;if(start>=stat.size||start>end){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});res.end();return;}res.writeHead(206,{...headers,'Content-Length':end-start+1,'Content-Range':`bytes ${start}-${end}/${stat.size}`});fs.createReadStream(file,{start,end}).pipe(res);}else{res.writeHead(200,{...headers,'Content-Length':stat.size});fs.createReadStream(file).pipe(res);}
}
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost'),origin=req.headers.origin;
 if(origin){const o=new URL(origin);if(['localhost','127.0.0.1'].includes(o.hostname)||/^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(o.hostname)){res.setHeader('Access-Control-Allow-Origin',origin);}else if(url.pathname.startsWith('/api/')){res.writeHead(403);res.end();return;}}
 res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('X-Content-Type-Options','nosniff');if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
 const json=(s,o)=>{res.writeHead(s,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(o));};
 try{
  if(url.pathname==='/api/state'){studio.touch(url.searchParams.get('client'));return json(200,currentState());}
  if(req.method==='GET'&&url.pathname==='/api/hardware/ports'){
   if(url.searchParams.get('transport')==='ble'){if(scanning||gateway.connecting||gateway.info.connected)throw Error('请先等待连接操作完成，或断开设备后再扫描');scanning=true;try{blePorts=await scanBlePorts();}finally{scanning=false;}}
   return json(200,{ports:await gateway.ports()});
  }
  if(req.method==='GET'&&url.pathname==='/api/session-log'){
   const id=url.searchParams.get('id');const report=studio.data.reports.find(r=>r.id===id)|| (studio.session?.id===id?studio.session:null);
   if(!report?.rawLog||!/^[a-zA-Z0-9-]{1,100}\.jsonl$/.test(report.rawLog))return json(404,{error:'没有可导出的原始记录'});
   res.setHeader('Content-Disposition',`attachment; filename="${report.rawLog}"`);return staticFile(req,res,path.join(dataDir,'sessions',report.rawLog));
  }
  if(url.pathname==='/api/network'){const ips=Object.values(os.networkInterfaces()).flat().filter(x=>x?.family==='IPv4'&&!x.internal).map(x=>x.address);return json(200,{ips,port:PORT});}
  if(req.method==='POST'&&url.pathname.startsWith('/api/')){
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2_000_000)throw Error('文件过大');}const body=JSON.parse(raw||'{}');
   if(url.pathname==='/api/hardware/connect'){if(scanning)throw Error('请等待蓝牙扫描完成');if(studio.session)throw Error('请先结束当前练习再切换设备');return json(200,await gateway.connect(body.path));}
   if(url.pathname==='/api/hardware/disconnect')return json(200,await gateway.disconnect());
   if(url.pathname==='/api/hardware/command'){
    if(studio.session&&/^(CALIB|RECORD|DELETE|RESET|LOAD)/i.test(String(body.command).trim()))throw Error('请先结束练习再修改设备校准或模板');
    const result=await gateway.command(body.command);
    if(result.command==='CALIB_MIN'){
     studio.data.calibration={learner:studio.data.settings.learner,fist:result.capturedValues,open:null,completed:false,at:result.at,source:'hardware'};persist();
    }else if(result.command==='CALIB_MAX'){
     studio.data.calibration={...(studio.data.calibration||{}),learner:studio.data.settings.learner,open:[2500,2500,2500,2500,2500],completed:true,at:result.at,source:'hardware',mappedEndpoints:true};
     // Templates recorded under the previous mapping must be reviewed before use.
     studio.data.templates=studio.data.templates.map(t=>({...t,needsReview:true}));persist();
    }else if(result.command.startsWith('RECORD ')){
     const [,slotText,toleranceText]=result.command.split(' '),slot=Number(slotText);
     const existing=studio.data.templates.find(t=>t.hardwareSlot===slot);
     const template={id:existing?.id||'hardware-slot-'+slot,hardwareSlot:slot,name:String(body.templateName||existing?.name||`${slot<5?'正确':'错误'}参考姿态 ${slot}`).slice(0,40),lesson:'揉泥基础',kind:slot<5?'correct':'incorrect',tolerance:Number(toleranceText),values:result.capturedValues,at:result.at,hardwareRecordedAt:result.at,valuesEvidence:'stable-sample-before-command',needsReview:false};
     studio.data.templates=studio.data.templates.filter(t=>t.hardwareSlot!==slot);studio.data.templates.push(template);persist();
    }
    return json(200,result);
   }
   if(url.pathname==='/api/sample'){if(gateway.info.connected)throw Error('电脑正在接收手套数据，不能混入其他采样来源');studio.ingest(body.values,body.name,body.source);if(studio.session&&!studio.session.paused)record({type:'sample',source:body.source,values:body.values});return json(200,{ok:true});}
   if(url.pathname==='/api/action'){
    if(body.type==='disconnect'&&gateway.info.connected)await gateway.disconnect();
    if(body.type==='start'&&gateway.pending)throw Error('请等待设备命令完成后再开始练习');
    if(body.type==='finish')record({type:'session-finish',elapsed:studio.elapsed()});
    const result=studio.action(body.type,body.payload);
    if(body.type==='start')record({type:'session-start',settings:studio.data.settings,templates:studio.data.templates,calibration:studio.data.calibration,hardware:{path:gateway.info.path,transport:gateway.info.transport,mode:gateway.info.mode}});
    else if(body.type==='pause'||body.type==='resume')record({type:body.type,elapsed:studio.elapsed()});
    persist();return json(200,body.type==='finish'?result:currentState());
   }
   return json(404,{error:'接口不存在'});
  }
  const target=url.pathname.startsWith('/mobile/')?path.join(root,'mobile/dist/client'):path.join(root,'desktop/dist/client');let rel=decodeURIComponent(url.pathname.startsWith('/mobile/')?url.pathname.slice(8):url.pathname.slice(1));
  if(url.pathname.startsWith('/media/'))return staticFile(req,res,path.join(root,'media',path.basename(rel)));
  if(url.pathname.startsWith('/mobile-assets/'))return staticFile(req,res,path.join(root,'mobile/dist/client/assets',path.basename(rel)));
  const file=path.resolve(target,rel||'index.html');if(!file.startsWith(target+path.sep)&&file!==target){res.writeHead(403);res.end();return;}
  const mobileFallback=path.resolve(root,'mobile/dist/client',rel);const mobileRoot=path.resolve(root,'mobile/dist/client');
  if(!fs.existsSync(file)&&mobileFallback.startsWith(mobileRoot+path.sep)&&fs.existsSync(mobileFallback)&&fs.statSync(mobileFallback).isFile())return staticFile(req,res,mobileFallback);
  staticFile(req,res,fs.existsSync(file)&&fs.statSync(file).isFile()?file:path.join(target,'index.html'));
 }catch(e){json(400,{error:e.message||'操作失败'});}
});
server.listen(PORT,'0.0.0.0',()=>console.log(`非遗之手 http://localhost:${PORT}`));
