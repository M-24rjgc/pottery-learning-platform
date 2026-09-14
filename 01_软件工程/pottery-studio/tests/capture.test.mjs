import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {SessionCapture} from '../hardware/capture.mjs';

test('session log persists ordered raw samples and events across capture instances',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'pottery-capture-test-'));
 const start={type:'session-start',learner:'测试'},sample={type:'sample',values:[500,600,700,800,900]};
 new SessionCapture(directory).append('session-test',start);
 const name=new SessionCapture(directory).append('session-test',sample);
 assert.deepEqual(fs.readFileSync(path.join(directory,name),'utf8').trim().split('\n').map(JSON.parse),[start,sample]);
 // Remove only the exact test-created file, leaving no recursive path operation.
 fs.unlinkSync(path.join(directory,name));fs.rmdirSync(directory);
});

test('session log rejects paths before creating an output directory',()=>{
 const capture=new SessionCapture(path.join(os.tmpdir(),'pottery-invalid-capture'));
 for(const id of ['../outside','a/b','C:\\outside','',null])assert.throws(()=>capture.append(id,{}),/无效会话/);
});
