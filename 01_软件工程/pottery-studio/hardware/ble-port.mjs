import {EventEmitter} from 'node:events';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline';
const directory=path.dirname(fileURLToPath(import.meta.url));
const bundledPython=path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
function worker(args,onMessage,onExit){
 const python=process.env.POTTERY_PYTHON||(fs.existsSync(bundledPython)?bundledPython:'python');
 const child=spawn(python,['-u',path.join(directory,'ble_worker.py'),...args],{windowsHide:true,stdio:['pipe','pipe','pipe']});
 child.stdin.on('error',error=>onMessage({type:'error',message:error.message}));
 let stderr='';child.stderr.on('data',b=>{stderr=(stderr+b).slice(-2000);});
 const lines=createInterface({input:child.stdout});lines.on('line',line=>{try{onMessage(JSON.parse(line));}catch{onMessage({type:'error',message:'蓝牙进程返回了无效消息'});}});
 child.on('error',e=>onMessage({type:'error',message:e.message}));
 child.on('close',code=>{lines.close();onExit(code,stderr);});
 return child;
}
export function scanBlePorts(){return new Promise((resolve,reject)=>{
 let result,error;const child=worker(['scan'],message=>{if(message.type==='ports')result=message.ports;if(message.type==='error')error=message.message;},(code,stderr)=>{clearTimeout(timer);if(code!==0||!result)reject(Error(error||stderr||'蓝牙扫描失败'));else resolve(result);});
 const timer=setTimeout(()=>{child.kill();reject(Error('蓝牙扫描超时'));},12000);
});}

// SerialPort-compatible adapter: the gateway continues to own lifecycle.
export class BlePort extends EventEmitter{
 constructor({path:portPath}){super();this.address=portPath.slice(4);this.isOpen=false;this.child=null;this.writes=new Map();this.nextId=0;}
 open(callback){
  let settled=false;const complete=error=>{if(settled)return;settled=true;clearTimeout(timer);callback(error);};
  const timer=setTimeout(()=>{complete(Error('蓝牙连接超时'));this.child?.kill();},22000);
  this.child=worker(['connect',this.address],message=>{
   if(message.type==='ready'){this.isOpen=true;complete();}
   else if(message.type==='data'&&/^(?:[a-f0-9]{2})+$/i.test(message.hex))this.emit('data',Buffer.from(message.hex,'hex'));
   else if(message.type==='written'||message.type==='write-error'){const cb=this.writes.get(message.id);this.writes.delete(message.id);cb?.(message.type==='write-error'?Error(message.message):undefined);}
   else if(message.type==='error'){const error=Error(message.message);if(!settled)complete(error);else this.emit('error',error);this.child?.kill();}
  },(code,stderr)=>{
   this.isOpen=false;this.child=null;for(const cb of this.writes.values())cb(Error('蓝牙已断开，写入结果未知'));this.writes.clear();if(!settled)complete(Error(stderr||'蓝牙连接未能建立'));
   this.emit('close');if(this.closeCallback){const cb=this.closeCallback;this.closeCallback=null;cb();}
  });
 }
 write(text,callback){
  const command=text.trim();if(!/^(?:HELP|STATUS|MODE [01]|CALIB_MIN|CALIB_MAX|SAVE|LOAD|RECORD [0-9] (?:[1-9][0-9]{0,2}|1000))$/.test(command)){callback(Error('此无线命令尚未开放'));return;}
  if(!this.isOpen||!this.child?.stdin.writable){callback(Error('蓝牙连接已关闭'));return;}
  const id=++this.nextId;this.writes.set(id,callback);
  this.child.stdin.write(JSON.stringify({id,command})+'\n',error=>{if(error){this.writes.delete(id);callback(error);}});
 }
 close(callback){
  if(!this.child){this.isOpen=false;callback();return;}
  this.closeCallback=callback;const child=this.child;child.stdin.end('stop\n');
  const timer=setTimeout(()=>{if(this.child===child)child.kill();},4000);timer.unref();
 }
}
