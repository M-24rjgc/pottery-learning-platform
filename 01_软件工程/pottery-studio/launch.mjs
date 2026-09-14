import {spawn} from 'node:child_process';
const jobs=[['server.mjs'],['desktop/node_modules/vite/bin/vite.js','--host','0.0.0.0','--port','4173','--strictPort'],['mobile/node_modules/vite/bin/vite.js','--host','0.0.0.0','--port','4174','--strictPort']];
const children=jobs.map((args,i)=>spawn(process.execPath,i?args.map((x,j)=>j===0?'node_modules/vite/bin/vite.js':x):args,{cwd:i?new URL(i===1?'./desktop/':'./mobile/',import.meta.url):new URL('.',import.meta.url),stdio:'inherit',windowsHide:true}));
process.on('SIGINT',()=>{children.forEach(x=>x.kill());process.exit();});
