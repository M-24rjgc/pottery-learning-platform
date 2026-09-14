import { randomUUID } from 'node:crypto';
export const fingers=['拇指','食指','中指','无名指','小指'];
export const emptyData=()=>({reports:[],templates:[],calibration:null,settings:{voice:true,tolerance:100,learner:'陶艺学习者',baudRate:115200,serviceUUID:'',notifyUUID:'',writeUUID:''}});
export const validValues=v=>Array.isArray(v)&&v.length===5&&v.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=65535);
export function parseSample(line){
 const clean=line.trim(); if(!clean)return null;
 try{const j=JSON.parse(clean);const v=Array.isArray(j)?j:j.values;return validValues(v)?v:null;}catch{}
 const a=clean.split(',').map(s=>s.trim());if(a.length!==5||a.some(s=>!s))return null;
 const v=a.map(Number);return validValues(v)?v:null;
}
export class Studio {
 constructor(data=emptyData(),now=Date.now){this.data={...emptyData(),...data,settings:{...emptyData().settings,...data.settings}};this.now=now;this.device={connected:false,name:'陶艺手套',source:'',values:null,lastSeen:0};this.session=null;this.samples=[];this.liveSamples=[];this.previewStartedAt=this.now();this.events=[];this.peers={};this.feedback={kind:'waiting',text:'等待手套数据'};this.lastMatch=null;this.streakStart=0;this.lastCount=0;}
 elapsed(){const s=this.session;return s?Math.max(0,Math.floor(((s.paused?s.pauseAt:this.now())-s.startedAt-s.pauseMs)/1000)):0;}
 fresh(){return this.device.connected&&this.now()-this.device.lastSeen<3500;}
 state(){return { ...this.data,device:{...this.device,connected:this.fresh()},session:this.session?{...this.session,elapsed:this.elapsed()}:null,samples:(this.session?this.samples:this.liveSamples).slice(-240),events:this.events.slice(-12).reverse(),feedback:this.fresh()?this.feedback:{kind:'waiting',text:'等待手套数据'},peers:{desktop:this.now()-(this.peers.desktop||0)<6000,mobile:this.now()-(this.peers.mobile||0)<6000}};}
 touch(client){if(['desktop','mobile'].includes(client))this.peers[client]=this.now();}
 event(text,kind='info'){this.events.push({id:randomUUID(),time:this.now(),elapsed:this.elapsed(),text,kind});this.events=this.events.slice(-100);}
 ingest(values,name='陶艺手套',source='serial'){
  if(!validValues(values))throw Error('需要五路有效的手指采样值');
  if(!['serial','ble','file'].includes(source))throw Error('未知数据来源');
  if(this.session&&!this.session.paused&&this.session.source&&this.session.source!==source)throw Error('一次练习不能混用文件记录与实时设备数据，请结束后重新开始');
  const t=this.now(),gap=t-this.device.lastSeen>3500;this.device={connected:true,name:String(name).slice(0,80),source,values,lastSeen:t};
  const match=this.data.templates.filter(x=>x.lesson==='揉泥基础'&&!x.needsReview).map(x=>({...x,distance:Math.max(...values.map((v,i)=>Math.abs(v-x.values[i])))})).filter(x=>x.distance<=x.tolerance).sort((a,b)=>a.distance-b.distance)[0];
  this.feedback=match?{kind:match.kind==='correct'?'match':'adjust',text:match.kind==='correct'?'姿态匹配':'需要调整',template:match.name,id:match.id}:{kind:this.data.templates.length?'adjust':'unconfigured',text:this.data.templates.length?'姿态尚未匹配':'请先录入参考姿态'};
  this.liveSamples.push({t,elapsed:(t-this.previewStartedAt)/1000,values:[...values],matched:this.feedback.kind==='match'});this.liveSamples=this.liveSamples.slice(-240);
  if(this.session&&!this.session.paused){
   if(this.session.source&&this.session.source!==source)throw Error('一次练习不能混用文件记录与实时设备数据，请结束后重新开始');
   this.session.source=source;this.session.sampleCount++;
   const point={t,elapsed:this.elapsed(),values:[...values],matched:this.feedback.kind==='match'};
   this.samples.push(point);this.samples=this.samples.slice(-12000);
   if(point.matched)this.session.matchedSamples++;
   const key=match?.id??null;
   if(gap||key!==this.lastMatch){this.streakStart=t;this.lastCount=0;if(key!==null)this.event(`${this.feedback.text} · ${match.name}`,this.feedback.kind);}
   if(point.matched&&t-this.streakStart>=1000&&!this.lastCount){this.session.matches++;this.lastCount=t;}
   this.lastMatch=key;
  }
  return this.feedback;
 }
 action(type,p={}){
  const t=this.now();
  switch(type){
   case 'start':if(this.session)throw Error('已有进行中的练习');this.session={id:randomUUID(),lesson:'揉泥基础',learner:this.data.settings.learner,startedAt:t,paused:false,pauseMs:0,pauseAt:0,sampleCount:0,matchedSamples:0,matches:0,source:null};this.samples=[];this.events=[];this.lastMatch=null;this.streakStart=t;this.lastCount=0;this.event('开始练习');break;
   case 'pause':if(!this.session)throw Error('没有进行中的练习');if(!this.session.paused){this.session.paused=true;this.session.pauseAt=t;this.lastMatch=null;}break;
   case 'resume':if(!this.session)throw Error('没有进行中的练习');if(this.session.paused){this.session.pauseMs+=t-this.session.pauseAt;this.session.paused=false;this.streakStart=t;this.lastMatch=null;this.lastCount=0;}break;
   case 'finish':{
    if(!this.session)throw Error('没有进行中的练习');const s=this.session;const r={...s,endedAt:t,duration:this.elapsed(),notes:String(p.notes||'').slice(0,2000),timeline:this.samples.filter((_,i)=>i%Math.max(1,Math.ceil(this.samples.length/60))===0).map(x=>({elapsed:x.elapsed,matched:x.matched})),ratio:s.sampleCount?Math.round(s.matchedSamples/s.sampleCount*100):null};
    this.data.reports.unshift(r);this.data.reports=this.data.reports.slice(0,500);this.session=null;this.samples=[];this.events=[];return r;
   }
   case 'disconnect':this.liveSamples=[];this.previewStartedAt=t;this.device.connected=false;this.device.values=null;this.lastMatch=null;break;
   case 'calibrate':{
    if(!this.fresh()||!validValues(this.device.values)||this.device.source==='file')throw Error('请连接手套并保持姿态后再采集');
    if(p.step==='fist'){this.data.calibration={learner:this.data.settings.learner,fist:[...this.device.values],open:null,completed:false,at:t};}
    else if(p.step==='open'){const c=this.data.calibration;if(!c?.fist)throw Error('请先采集握拳姿态');if(this.device.values.some((v,i)=>Math.abs(v-c.fist[i])<20))throw Error('部分手指变化太小，请充分张开五指后重试');c.open=[...this.device.values];c.completed=true;c.at=t;}
    else throw Error('未知校准步骤');break;
   }
   case 'template':{
    if(!this.fresh()||this.device.source==='file')throw Error('请先连接手套并保持需要录入的姿态');
    const name=String(p.name||'').trim();if(!name)throw Error('请填写手势名称');
    const tol=Number(p.tolerance??this.data.settings.tolerance);if(!(tol>=1&&tol<=5000))throw Error('容差应在1至5000之间');
    const id=p.id||randomUUID();this.data.templates=this.data.templates.filter(x=>x.id!==id);this.data.templates.push({id,name:name.slice(0,40),lesson:'揉泥基础',kind:p.kind==='incorrect'?'incorrect':'correct',tolerance:tol,values:[...this.device.values],at:t});break;
   }
   case 'deleteTemplate':this.data.templates=this.data.templates.filter(x=>x.id!==p.id);break;
   case 'settings':{
    const allowed=['voice','learner','tolerance','baudRate','serviceUUID','notifyUUID','writeUUID'];for(const k of allowed)if(p[k]!==undefined){if(k==='voice')this.data.settings[k]=Boolean(p[k]);else if(k==='tolerance'){const n=Number(p[k]);if(n<1||n>5000||!Number.isFinite(n))throw Error('容差应在1至5000之间');this.data.settings[k]=n;}else if(k==='baudRate'){if(![9600,19200,38400,57600,115200,230400].includes(Number(p[k])))throw Error('不支持的波特率');this.data.settings[k]=Number(p[k]);}else this.data.settings[k]=String(p[k]).slice(0,120);}break;
   }
   case 'deleteReport':this.data.reports=this.data.reports.filter(r=>r.id!==p.id);break;
   case 'importTemplates':{
    if(!Array.isArray(p.templates)||p.templates.length>100)throw Error('手势文件格式不正确');const incoming=p.templates.map(x=>{if(!validValues(x.values)||!['correct','incorrect'].includes(x.kind)||!x.name||!(x.tolerance>=1&&x.tolerance<=5000))throw Error('手势文件包含无效条目');return {...x,id:randomUUID(),name:String(x.name).slice(0,40),lesson:'揉泥基础'};});this.data.templates.push(...incoming);break;
   }
   default:throw Error('未知操作');
  }
  return this.state();
 }
}
