import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {LineDecoder,parseGloveLine,commandSpec} from '../hardware/protocol.mjs';
import {GloveGateway} from '../hardware/gateway.mjs';

class Port extends EventEmitter{
 constructor(){super();this.isOpen=false;this.writes=[];}
 open(cb){this.isOpen=true;cb();}
 close(cb){this.isOpen=false;this.emit('close');cb();}
 write(text,cb){this.writes.push(text);cb();}
 rx(text){this.emit('data',Buffer.from(text+'\r\n'));}
}
async function setup(options={}){const port=new Port();const gateway=new GloveGateway({createPort:()=>port,listPorts:async()=>[{path:'COM_TEST'}],...options});await gateway.connect('COM_TEST');port.rx('D,600,700,800,900,1000');return {port,gateway};}

test('actual firmware samples and events retain their different meanings',()=>{
 assert.deepEqual(parseGloveLine('D,500,1000,1500,2000,2500'),{type:'sample',values:[500,1000,1500,2000,2500]});
 assert.equal(parseGloveLine('D,0,1000,1500,2000,2500'),null);
 assert.deepEqual(parseGloveLine('ERR:mask=0'),{type:'gesture',kind:'incorrect',id:null,mask:0});
 assert.equal(parseGloveLine('OK:G=3').id,3);
 assert.equal(parseGloveLine('MODE:1').mode,1);
});
test('decoder handles every UTF8 byte split and discards overlong lines without misparsing tail',()=>{
 const lines=[];let overflows=0;const d=new LineDecoder(l=>lines.push(l),()=>overflows++);
 for(const byte of Buffer.from('校准完成!\r\nD,500,500,500,500,500\n'))d.push(Buffer.from([byte]));
 d.push(Buffer.from('x'.repeat(4200)+'D,500,500,500,500,500\nMODE:1\n'));
 assert.deepEqual(lines,['校准完成!','D,500,500,500,500,500','MODE:1']);assert.equal(overflows,1);
});
test('command validation rejects injection and unsafe tolerance',()=>{
 for(const input of ['SAVE\nRESET','RECORD 10 100','RECORD 1 0','RECORD 1 5000','MODE','THRESHOLD 0 1,2'])assert.throws(()=>commandSpec(input));
 assert.equal(commandSpec('record 2').text,'RECORD 2 100');
});
test('serial write success does not acknowledge device execution; unrelated lines do not acknowledge',async()=>{
 const {port,gateway}=await setup();let done=false;const promise=gateway.command('SAVE').then(r=>{done=true;return r;});
 await Promise.resolve();assert.equal(done,false);port.rx('手势已保存到 EEPROM');await Promise.resolve();assert.equal(done,false);
 port.rx('配置已保存到 EEPROM');assert.equal((await promise).status,'acknowledged');assert.equal(gateway.state().unsaved,false);await gateway.disconnect();
});
test('timeout blocks later writes and rejects a late response as confirmation',async()=>{
 const {port,gateway}=await setup({timeoutMs:20});await assert.rejects(gateway.command('SAVE'),/超时/);
 port.rx('配置已保存到 EEPROM');await assert.rejects(gateway.command('SAVE'),/重新连接/);assert.equal(port.writes.length,1);await gateway.disconnect();
});
test('pending command is rejected on disconnect and commands cannot overlap',async()=>{
 const {gateway}=await setup();const promise=gateway.command('SAVE');const rejected=assert.rejects(promise,/连接已关闭/);
 await assert.rejects(gateway.command('MODE 1'),/上一条命令/);await gateway.disconnect();await rejected;
});
test('calibration requires movement in every finger before CALIB_MAX is sent',async()=>{
 const {gateway,port}=await setup();await assert.rejects(gateway.command('CALIB_MAX'),/先采集握拳/);
 const fist=gateway.command('CALIB_MIN');port.rx('校准: 最小值已记录 (当前 600,700,800,900,1000)');await fist;
 port.rx('D,600,1700,1800,1900,2000');await assert.rejects(gateway.command('CALIB_MAX'),/变化太小/);
 assert.deepEqual(port.writes,['CALIB_MIN\n']);port.rx('D,1600,1700,1800,1900,2000');
 const open=gateway.command('CALIB_MAX');port.rx('校准完成! 张开=2500,2500,2500,2500,2500');await open;
 assert.equal(gateway.state().calibrationStage,'complete');assert.equal(gateway.state().unsaved,true);await gateway.disconnect();
});
test('mode1 keeps transport connection but ages samples and recognition independently',async()=>{
 let now=10000;const {gateway,port}=await setup({now:()=>now});port.rx('MODE:1');port.rx('OK:G=0');now+=4000;
 const s=gateway.state();assert.equal(s.connected,true);assert.equal(s.sampleFresh,false);assert.equal(s.mode,1);assert.equal(s.recognition,null);await gateway.disconnect();
});
test('unlisted serial path is never opened',async()=>{
 let opened=0;const gateway=new GloveGateway({createPort:()=>{opened++;},listPorts:async()=>[]});await assert.rejects(gateway.connect('COM_OTHER'),/设备列表/);assert.equal(opened,0);
});

test('quiet recognition device can explicitly return to acquisition without an unsolicited write',async()=>{
 const port=new Port();const gateway=new GloveGateway({createPort:()=>port,listPorts:async()=>[{path:'COM_TEST'}]});
 await gateway.connect('COM_TEST');assert.deepEqual(port.writes,[]);
 await assert.rejects(gateway.command('SAVE'),/尚未识别/);
 const mode=gateway.command('MODE 0');port.rx('MODE:0');await mode;
 port.rx('D,600,700,800,900,1000');assert.equal(gateway.state().sampleFresh,true);
 await gateway.disconnect();assert.equal(gateway.state().sampleFresh,false);
});

test('BLE status confirms only mode; unavailable template listing and reset are blocked',async()=>{
 const port=new Port();const gateway=new GloveGateway({createPort:()=>port,listPorts:async()=>[{path:'BLE:TEST',transport:'ble'}]});
 await gateway.connect('BLE:TEST');port.rx('D,600,700,800,900,1000');
 for(const command of ['LIST','RESET','DELETE 0'])await assert.rejects(gateway.command(command),/此无线命令不可用/);
 assert.equal(port.writes.length,0);
 const pending=gateway.command('STATUS');port.rx('模式: 0=采集');const response=await pending;
 assert.equal(response.scope,'mode-only');assert.equal(gateway.state().mode,0);await gateway.disconnect();
});

test('BLE mode command needs its matching binary response; heartbeat cannot confirm it',async()=>{
 const port=new Port();const gateway=new GloveGateway({createPort:()=>port,listPorts:async()=>[{path:'BLE:TEST',transport:'ble'}]});
 await gateway.connect('BLE:TEST');port.rx('D,600,700,800,900,1000');let done=false;
 const promise=gateway.command('MODE 1').then(r=>{done=true;return r;});
 port.emit('data',Buffer.from([85,85,2,7,5]));await Promise.resolve();assert.equal(done,false);
 port.emit('data',Buffer.from([85,85,3,3,1,1]));assert.equal((await promise).reply,'MODE:1');
 assert.equal(gateway.state().mode,1);await gateway.disconnect();
});
