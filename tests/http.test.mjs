import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createServer} from '../server.mjs';
import {Store} from '../store.mjs';
test('HTTP flow preserves the human note in persisted storage and refuses cross-site writes',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'rethread-http-')),store=new Store(dir),server=createServer(store);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 try{
  const html=await fetch(base).then(r=>r.text());assert.match(html,/Take back its changes/);
  const {token}=await fetch(base+'/api/state').then(r=>r.json());
  const post=(route,body,extra={})=>fetch(base+'/api/'+route,{method:'POST',headers:{'content-type':'application/json','x-rethread-token':token,...extra},body:JSON.stringify(body)});
  assert.equal((await post('example',{scenario:'independent'},{origin:'https://foreign.example'})).status,403);
  assert.equal((await post('example',{scenario:'independent'},{'x-rethread-token':'wrong'})).status,403);
  assert.equal((await post('example',{scenario:'independent'})).status,200);
  const {plan}=await post('preview',{run:'a'}).then(r=>r.json());assert.equal(plan.canApply,true);
  const {state}=await post('undo',{run:'a',expectedRevision:plan.revision}).then(r=>r.json());assert.equal(state.records['calendar:interview'].start,'2026-11-25T10:00');assert.match(state.records['calendar:interview'].notes,/accessible/);
  assert.deepEqual((await new Store(dir).read()).records,state.records);
  assert.equal((await post('undo',{run:'a',expectedRevision:plan.revision})).status,400);
 }finally{await new Promise(resolve=>server.close(resolve));await fs.rm(dir,{recursive:true,force:true});}
});
