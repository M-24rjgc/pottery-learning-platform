import {spawn} from 'node:child_process';
import {EventEmitter} from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const bundled=path.resolve(root,'../../06_整理工具与核验/整理工具/视频审阅/tooldeps/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe');
const executable=()=>process.env.POTTERY_FFMPEG||(fs.existsSync(bundled)?bundled:'ffmpeg');

export class JpegFrames{
 constructor(onFrame){this.onFrame=onFrame;this.buffer=Buffer.alloc(0);}
 push(bytes){
  this.buffer=Buffer.concat([this.buffer,bytes]);
  while(this.buffer.length){
   const start=this.buffer.indexOf(Buffer.from([255,216]));
   if(start<0){this.buffer=this.buffer.subarray(-1);return;}
   if(start)this.buffer=this.buffer.subarray(start);
   const end=this.buffer.indexOf(Buffer.from([255,217]),2);
   if(end<0){if(this.buffer.length>5_000_000)this.buffer=Buffer.alloc(0);return;}
   this.onFrame(this.buffer.subarray(0,end+2));this.buffer=this.buffer.subarray(end+2);
  }
 }
}

export class Camera extends EventEmitter{
 constructor(){super();this.child=null;this.frame=null;this.name='';this.lastFrameAt=null;this.error='';this.recorder=null;this.paused=false;}
 state(){return {name:this.name,opened:!!this.child,live:!!this.child&&Date.now()-this.lastFrameAt<3000,lastFrameAt:this.lastFrameAt,error:this.error,recording:!!this.recorder};}
 async devices(){return new Promise((resolve,reject)=>{
  const child=spawn(executable(),['-hide_banner','-list_devices','true','-f','dshow','-i','dummy'],{windowsHide:true,stdio:['ignore','ignore','pipe']});let output='';
  const timer=setTimeout(()=>{child.kill();reject(Error('摄像头枚举超时'));},7000);
  child.stderr.on('data',b=>output+=b);child.on('error',e=>{clearTimeout(timer);reject(e);});
  child.on('close',()=>{clearTimeout(timer);resolve([...output.matchAll(/"([^"]+)" \(video\)/g)].map(m=>m[1]));});
 });}
 async start(name){
  if(this.child)throw Error('摄像头已经打开');
  if(!(await this.devices()).includes(name))throw Error('请选择已识别到的摄像头');
  this.error='';this.name=name;this.frame=null;this.lastFrameAt=null;
  const child=spawn(executable(),['-hide_banner','-loglevel','error','-rtbufsize','100M','-f','dshow','-i','video='+name,'-an','-vf','fps=6,scale=640:-2','-c:v','mjpeg','-q:v','4','-f','image2pipe','pipe:1'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  this.child=child;let errorText='';child.stderr.on('data',b=>errorText=(errorText+b).slice(-1000));
  const decoder=new JpegFrames(frame=>{
   this.frame=Buffer.from(frame);this.lastFrameAt=Date.now();this.emit('frame');
   const r=this.recorder;if(r&&!this.paused&&r.child.stdin.writable&&!r.child.stdin.writableNeedDrain){r.child.stdin.write(frame);r.frames++;}
  });child.stdout.on('data',bytes=>decoder.push(bytes));
  child.on('error',error=>{this.error=error.message;this.emit('camera-error',this.error);});
  child.on('close',()=>{if(this.child===child){this.child=null;this.frame=null;if(errorText)this.error=errorText;this.emit('camera-closed');}});
  await new Promise((resolve,reject)=>{
   const done=()=>{clearTimeout(timer);this.off('frame',ready);this.off('camera-error',failed);child.off('close',closed);};
   const ready=()=>{done();resolve();},failed=e=>{done();reject(Error(e));},closed=()=>{done();reject(Error(errorText||'摄像头未能启动'));};
   const timer=setTimeout(()=>{done();child.kill();reject(Error('摄像头没有返回画面'));},10000);
   this.once('frame',ready);this.once('camera-error',failed);child.once('close',closed);
  });return this.state();
 }
 async stop(){
  if(this.recorder)throw Error('请先结束当前录像练习');
  const child=this.child;if(!child)return this.state();
  await new Promise(resolve=>{const timer=setTimeout(()=>child.kill(),2500);child.once('close',()=>{clearTimeout(timer);resolve();});child.stdin.end('q\n');});return this.state();
 }
 startRecording(id){
  if(!this.state().live)throw Error('摄像头没有实时画面');if(this.recorder)throw Error('已有练习录像');
  if(!/^[a-zA-Z0-9-]{1,100}$/.test(id))throw Error('无效练习ID');
  const directory=path.join(root,'data/recordings');fs.mkdirSync(directory,{recursive:true});const name=id+'.mp4';
  const child=spawn(executable(),['-hide_banner','-loglevel','error','-n','-f','image2pipe','-vcodec','mjpeg','-framerate','6','-i','pipe:0','-an','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-movflags','+faststart',path.join(directory,name)],{windowsHide:true,stdio:['pipe','ignore','pipe']});
  const recording={child,name,frames:0,error:'',closed:false};child.stderr.on('data',b=>recording.error=(recording.error+b).slice(-1000));child.stdin.on('error',e=>recording.error=e.message);child.on('error',e=>recording.error=e.message);
  recording.finished=new Promise(resolve=>child.on('close',code=>{recording.closed=true;recording.exitCode=code;resolve();}));this.recorder=recording;this.paused=false;return name;
 }
 async finishRecording(){
  const r=this.recorder;if(!r)return null;this.recorder=null;
  r.child.stdin.end();const timer=setTimeout(()=>r.child.kill(),10000);
  await r.finished;clearTimeout(timer);
  if(r.exitCode!==0||!r.frames)throw Error(r.error||'未录到有效画面');return {file:r.name,frames:r.frames,fps:6};
 }
}
