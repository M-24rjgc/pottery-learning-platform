import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const project=path.join(root,'01_软件工程/pottery-studio');
const record=path.join(root,'06_整理工具与核验/整理记录/2026-09-13');
const readJSON=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const result={checkedAt:new Date().toISOString(),attachmentChecks:[],links:[],http:[],mobileRuntime:''};
const manifest=readJSON(path.join(root,'06_整理工具与核验/审阅证据/2026-09-13/attachments.json'));
for(const item of manifest){
  const file=path.join(root,item.snapshot);
  const digest=createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if(digest!==item.sha256.toLowerCase())throw Error('Attachment hash mismatch: '+file);
  result.attachmentChecks.push({path:item.snapshot,sha256:digest,ok:true});
}
const indexes=['README.md','01_软件工程/README.md','02_硬件工程/README.md','03_项目文档/文档索引.md','04_素材资源/素材索引.md','05_交付归档/README.md','06_整理工具与核验/README.md'];
for(const rel of indexes){
  const file=path.join(root,rel),text=fs.readFileSync(file,'utf8');
  for(const match of text.matchAll(/\[[^\]]*\]\(((?:[^()]|\([^()]*\))*)\)/g)){
    const target=match[1];if(/^[a-z]+:/i.test(target)||target.startsWith('#'))continue;
    const resolved=path.resolve(path.dirname(file),target.split('#')[0]);
    if(!fs.existsSync(resolved))throw Error('Broken link: '+rel+' -> '+target);
    result.links.push({from:rel,target,ok:true});
  }
}
result.mobileRuntime=execFileSync(process.execPath,['scripts/check-mobile-runtime.mjs'],{cwd:path.join(project,'mobile'),encoding:'utf8'}).trim();
const child=spawn(process.execPath,['server.mjs'],{cwd:project,env:{...process.env,PORT:'4197'},stdio:['ignore','pipe','pipe'],windowsHide:true});
let output='';child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);
try{
  for(let n=0;n<40&&!output.includes('http://localhost:4197');n++){
    if(child.exitCode!==null)throw Error('Temporary server exited: '+output);
    await new Promise(r=>setTimeout(r,100));
  }
  if(!output.includes('http://localhost:4197'))throw Error('Server startup timeout: '+output);
  const origin='http://127.0.0.1:4197';
  const targets=['/','/mobile/','/api/state','/media/lesson-0.mp4','/media/lesson-1.mp4','/media/lesson-2.mp4','/art/pottery-hands.png','/art/glove-fist.png','/art/glove-open.png'];
  for(const route of targets){
    const res=await fetch(origin+route,{headers:route.includes('.mp4')?{Range:'bytes=0-1023'}:{},signal:AbortSignal.timeout(5000)});
    if(!res.ok)throw Error('HTTP failure: '+route+' '+res.status);
    const type=res.headers.get('content-type');
    if(route.endsWith('.mp4')&&(res.status!==206||!type.includes('video/mp4')))throw Error('Invalid video response');
    if(route.endsWith('.png')&&!type.includes('image/png'))throw Error('Invalid image response');
    if(route==='/api/state'){
      const state=await res.json();if(!Array.isArray(state.reports)||!state.settings)throw Error('Invalid state');
    }else if(route==='/'||route==='/mobile/'){
      const html=await res.text();if(!html.includes('id="root"'))throw Error('Invalid app HTML');
      for(const m of html.matchAll(/(?:src|href)="([^"#]+\.(?:js|css))"/g)){
        const asset=new URL(m[1],origin+route).href;
        const a=await fetch(asset,{signal:AbortSignal.timeout(5000)});
        if(!a.ok||a.headers.get('content-type')?.includes('text/html'))throw Error('Missing app asset: '+asset);
        await a.arrayBuffer();result.http.push({route:new URL(asset).pathname,status:a.status,ok:true});
      }
    }else await res.arrayBuffer();
    result.http.push({route,status:res.status,contentType:type,ok:true});
  }
}finally{
  if(child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}
}
result.scope='Read-only file, source-integrity and HTTP checks. Temporary server stopped. No hardware operation or browser/WeChat acceptance.';
fs.writeFileSync(path.join(record,'整理后验证.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({attachments:result.attachmentChecks.length,localLinks:result.links.length,httpResources:result.http.length,mobileRuntime:result.mobileRuntime,temporaryServerStopped:true},null,2));
