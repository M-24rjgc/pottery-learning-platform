import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeHost,validateState,snapshot,isLive,makeClient,reportText} from '../src/model.mjs';
import {Studio} from '../../pottery-studio/core.mjs';

test('LAN address normalization and explicit protocol/port',()=>{
 assert.equal(normalizeHost(' 192.168.1.8 ',true),'http://192.168.1.8:4180');
 assert.equal(normalizeHost('https://studio.example:8443/'), 'https://studio.example:8443');
 assert.equal(normalizeHost('10.1.2.3:4180'), 'http://10.1.2.3:4180');
});
test('native client rejects loopback, credentials, paths and query',()=>{
 for(const input of ['localhost:4180','127.0.0.1','http://[::1]','http://u:p@example.com','http://example.com/api','http://example.com?a=1','file:///tmp/a',''])assert.throws(()=>normalizeHost(input,true));
});
test('unrelated JSON is rejected before marking a host connected',()=>{
 for(const data of [{},null,{reports:[],templates:[],device:{},settings:{}}])assert.throws(()=>validateState(data));
 assert.equal(validateState(new Studio().state()).reports.length,0);
});
test('live state expires even if a network request is hung',()=>{
 assert.equal(isLive(true,1000,4499),true);
 assert.equal(isLive(true,1000,4500),false);
 assert.equal(isLive(false,1000,1001),false);
});
test('offline cache excludes live values/session and is capped',()=>{
 const s=new Studio().state();s.reports=Array.from({length:70},(_,id)=>({id}));
 const c=snapshot(s,'http://10.0.0.2:4180',1234);
 assert.equal(c.reports.length,50);assert.equal(c.savedAt,1234);
 assert.equal(c.device,undefined);assert.equal(c.session,undefined);
});
test('write timeout is not retried and explains uncertain outcome',async()=>{
 let calls=0;const request=makeClient(async()=>{calls++;throw Error('timeout');},'http://10.0.0.2:4180');
 await assert.rejects(request('/api/action',{type:'finish'}),/可能已生效/);assert.equal(calls,1);
});
test('device/server rejection reaches the user unchanged',async()=>{
 const request=makeClient(async()=>({status:400,data:{error:'请先结束当前练习'}}),'http://host');
 await assert.rejects(request('/api/action',{type:'start'}),/请先结束当前练习/);
});
test('client contract integrates start, stable match, pause, resume, finish with real Studio core',async()=>{
 let now=100000;const studio=new Studio(undefined,()=>now);
 studio.ingest([2500,2500,2500,2500,2500],'测试夹具','ble');
 studio.action('template',{name:'合成测试参考',tolerance:300});
 const request=makeClient(async(url,body)=>({status:200,data:body?studio.action(body.type,body.payload):studio.state()}),'http://test');
 const action=(type,payload={})=>request('/api/action',{type,payload});
 await action('start');
 for(let i=0;i<8;i++){now+=200;studio.ingest([2500,2500,2500,2500,2500],'测试夹具','ble');}
 assert.equal(studio.session.matches,1);
 await action('pause');const count=studio.session.sampleCount;
 now+=5000;studio.ingest([2500,2500,2500,2500,2500],'测试夹具','ble');assert.equal(studio.session.sampleCount,count);
 await action('resume');now+=200;studio.ingest([500,500,500,500,500],'测试夹具','ble');
 const report=await action('finish',{notes:'合成数据测试，不是实物结果'});
 assert.equal(report.sampleCount,9);assert.equal(report.matches,1);assert.equal(report.duration,1);
 assert.match(reportText(report),/合成数据测试/);assert.match(reportText(report),/不代表陶艺专业评分/);
 assert.equal((await request('/api/state')).session,null);
});
