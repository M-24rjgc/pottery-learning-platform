import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BleStreamDecoder} from '../hardware/ble-stream.mjs';
import {LineDecoder,parseGloveLine} from '../hardware/protocol.mjs';
import {Studio} from '../core.mjs';

test('mixed BLE text and heartbeat survive every possible two-chunk boundary',()=>{
 const input=Buffer.concat([Buffer.from('D,1540,1733,1438,1270,1626\r\n'),Buffer.from([0x55,0x55,2,7,5]),Buffer.from('D,500,600,700,800,900\r\n')]);
 for(let split=0;split<=input.length;split++){
  const lines=[],frames=[];const text=new LineDecoder(line=>lines.push(line));const decoder=new BleStreamDecoder(bytes=>text.push(bytes),frame=>frames.push(frame));
  decoder.push(input.subarray(0,split));decoder.push(input.subarray(split));
  assert.deepEqual(lines,['D,1540,1733,1438,1270,1626','D,500,600,700,800,900']);assert.equal(frames.length,1);assert.equal(frames[0].command,7);
 }
});
test('BLE invalid checksum never becomes a gesture and following text remains readable',()=>{
 const frames=[],lines=[];let invalid=0;const text=new LineDecoder(line=>lines.push(line));const decoder=new BleStreamDecoder(bytes=>text.push(bytes),f=>frames.push(f),()=>invalid++);
 for(const byte of Buffer.concat([Buffer.from([85,85,3,1,0,255]),Buffer.from('D,500,500,500,500,500\n')]))decoder.push(Buffer.from([byte]));
 assert.equal(invalid,1);assert.equal(frames.length,0);assert.equal(parseGloveLine(lines[0]).type,'sample');
});
test('live graph does not create a practice report or include preview samples in a later session',()=>{
 const s=new Studio();s.ingest([500,600,700,800,900],'Glove','ble');assert.equal(s.state().samples.length,1);assert.equal(s.session,null);assert.equal(s.data.reports.length,0);
 s.action('start');assert.equal(s.state().samples.length,0);assert.equal(s.session.sampleCount,0);
 s.action('pause');s.ingest([600,600,700,800,900],'Glove','ble');assert.equal(s.session.sampleCount,0);
});
