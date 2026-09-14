// In-memory promotional demonstration. No hardware imports, no production data access.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Studio,emptyData} from '../core.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let clock=Date.now()-300000;
const studio=new Studio(emptyData(),()=>clock);
studio.data.settings={...studio.data.settings,learner:'演示学习者',voice:false};
const target=[1220,1480,1680,1550,1340];
studio.ingest(target,'演示手套','ble');
studio.action('template',{name:'揉泥按压 · 演示参考',tolerance:180});
studio.data.calibration={learner:'演示学习者',fist:[500,500,500,500,500],open:[2500,2500,2500,2500,2500],completed:true,source:'demo'};
function values(t){const phase=t%10000;return target.map((v,i)=>Math.round(v+(phase<4500?40*Math.sin(t/700+i):400*Math.sin((phase-4500)/5500*Math.PI+i*.18))));}
studio.action('start');
for(let i=0;i<900;i++){clock+=200;studio.ingest(values(i*200),'演示手套','ble');}
studio.action('finish',{notes:'演示数据：从缓慢按压开始，保持节奏，观察五指变化。'});
clock=Date.now()-72000;studio.action('start');
for(let i=0;i<360;i++){clock+=200;studio.ingest(values(i*200),'演示手套','ble');}
setInterval(()=>{clock=Date.now();studio.ingest(values(studio.session?clock-studio.session.startedAt:clock),'演示手套','ble');},200);
function state(){studio.touch('desktop');studio.touch('mobile');return {...studio.state(),demo:true,hardware:{connected:true,sampleFresh:true,mode:0,transport:'ble',canControl:false,calibrationStage:'complete',lastSampleAt:clock,values:studio.device.values}};}
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.mp4':'video/mp4'};
function handler(app){return async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(req.headers.origin==='http://localhost:4193')res.setHeader('Access-Control-Allow-Origin',req.headers.origin);
 res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Cache-Control','no-store');
 const json=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
 if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
 try{
  if(url.pathname==='/api/state')return json(200,state());
  if(url.pathname.startsWith('/api/hardware'))return json(403,{error:'演示环境不发送硬件命令'});
  if(url.pathname==='/api/action'&&req.method==='POST'){
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>10000)throw Error('请求过大');}
   const {type,payload}=JSON.parse(raw);if(!['start','pause','resume','finish'].includes(type))throw Error('演示环境只允许练习操作');
   clock=Date.now();const result=studio.action(type,payload);return json(200,type==='finish'?result:state());
  }
  if(url.pathname.startsWith('/api/'))return json(404,{error:'演示接口不存在'});
  const base=url.pathname.startsWith('/media/')?path.join(root,'media'):app?path.resolve(root,'../pottery-app/dist'):path.join(root,'.demo/desktop');
  const relative=url.pathname.startsWith('/media/')?url.pathname.slice(7):url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).slice(1);
  const file=path.resolve(base,relative);if(!file.startsWith(base+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
  if(file.endsWith('.html')){const marker=`<div style="position:fixed;right:16px;${app?'top:65px':'bottom:10px'};z-index:99999;font:11px sans-serif;background:#eef2e7;color:#4a6653;border:1px solid #cad6c5;border-radius:20px;padding:5px 10px;pointer-events:none">演示数据 · 非实物采集</div>`;return res.end(fs.readFileSync(file,'utf8').replace('</body>',marker+'</body>'));}
  const size=fs.statSync(file).size;const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);if(range){const start=Number(range[1]),end=Math.min(Number(range[2]||size-1),size-1);if(start>end){res.writeHead(416);return res.end();}res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${size}`,'Accept-Ranges':'bytes','Content-Length':end-start+1});return fs.createReadStream(file,{start,end}).pipe(res);}
  fs.createReadStream(file).pipe(res);
 }catch(e){json(400,{error:e.message});}
};}
http.createServer(handler(false)).listen(4192,'127.0.0.1',()=>console.log('Demo desktop http://localhost:4192'));
http.createServer(handler(true)).listen(4193,'127.0.0.1',()=>console.log('Demo app http://localhost:4193 — connect to localhost:4192'));
