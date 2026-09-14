// Isolated browser acceptance fixture. Never reads/writes production data.
import http from 'node:http';
import {Studio} from '../../pottery-studio/core.mjs';
const studio=new Studio();
studio.data.settings.learner='隔离测试 · 合成数据';
studio.ingest([2500,2500,2500,2500,2500],'合成测试手套','ble');
studio.action('template',{name:'合成数据参考',tolerance:300});
setInterval(()=>studio.ingest([2500,2500,2500,2500,2500],'合成测试手套','ble'),200);
http.createServer(async(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','http://localhost:4190');
 res.setHeader('Access-Control-Allow-Headers','Content-Type');
 res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
 const state=()=>({...studio.state(),hardware:{connected:true,sampleFresh:true,mode:0,transport:'ble'}});
 try {
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  let body='';for await(const chunk of req)body+=chunk;
  let data=state();if(req.method==='POST'){const a=JSON.parse(body);const r=studio.action(a.type,a.payload);data=a.type==='finish'?r:state();}
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(data));
 }catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}
}).listen(4191,'127.0.0.1',()=>console.log('Isolated QA fixture: http://127.0.0.1:4191'));
