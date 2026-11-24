import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {Store} from '../store.mjs';
import {rpc} from '../protocol.mjs';
const temporary=async fn=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'rethread-test-'));try{await fn(dir);}finally{await fs.rm(dir,{recursive:true,force:true});}};
test('persistent workspace survives a new store instance',()=>temporary(async dir=>{
 const first=new Store(dir);await first.example('independent');const second=new Store(dir);const p=await second.preview('a');assert.equal(p.canApply,true);await second.undo({run:'a',expectedRevision:p.revision});const final=await new Store(dir).read();assert.equal(final.records['calendar:interview'].start,'2026-11-25T10:00');assert.match(final.records['calendar:interview'].notes,/accessible/);
}));
test('a failed mutation does not alter persistent bytes',()=>temporary(async dir=>{
 const s=new Store(dir);await s.example('overlap');const before=await fs.readFile(s.file,'utf8'),revision=(await s.read()).revision;await assert.rejects(()=>s.undo({run:'a',expectedRevision:revision}),/blocked/);assert.equal(await fs.readFile(s.file,'utf8'),before);
}));
test('another writer lock prevents uncoordinated mutation',()=>temporary(async dir=>{
 const s=new Store(dir);await fs.writeFile(s.lock,'');await assert.rejects(()=>s.example('independent'),/writer/);assert.equal(await fs.readFile(s.lock,'utf8'),'');
}));
test('loading a new example cannot reuse a previously reviewed revision',()=>temporary(async dir=>{
 const s=new Store(dir);await s.example('independent');const old=await s.preview('a');await s.example('dependent');await assert.rejects(()=>s.undo({run:'a',expectedRevision:old.revision}),/fresh plan/);
}));
test('MCP tool call refuses extra properties and hides no errors',()=>temporary(async dir=>{
 const s=new Store(dir),reply=await rpc(s,{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'edit_record',arguments:{run:'a',resource:'notes:travel',expectedRevision:0,actor:'human',patch:{budget:1}}}});assert.equal(reply.result.isError,true);assert.equal((await s.read()).revision,0);
 const inherited=await rpc(s,{jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'read_workspace',arguments:JSON.parse('{"constructor":"x"}')}});assert.equal(inherited.result.isError,true);
}));
test('actual stdio subprocess edits, previews and restores persisted data',()=>temporary(async dir=>{
 const messages=[
  {jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'integration-test',version:'1'}}},
  {jsonrpc:'2.0',method:'notifications/initialized'},
  {jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'edit_record',arguments:{run:'agent1',resource:'calendar:interview',patch:{start:'2026-11-25T14:00'},expectedRevision:0}}},
  {jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'preview_undo',arguments:{run:'agent1'}}},
  {jsonrpc:'2.0',id:4,method:'tools/call',params:{name:'apply_undo',arguments:{run:'agent1',expectedRevision:1}}}
 ];
 const p=spawn(process.execPath,[fileURLToPath(new URL('../mcp.mjs',import.meta.url))],{env:{...process.env,RETHREAD_DATA_DIR:dir}});let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.stdin.end(messages.map(JSON.stringify).join('\n')+'\n');await new Promise((resolve,reject)=>{p.once('error',reject);p.once('exit',code=>code===0?resolve():reject(Error(err)));});
 const replies=out.trim().split('\n').map(JSON.parse);assert.equal(replies.length,4);assert.equal(replies[0].result.serverInfo.name,'rethread-reference');assert.equal(replies[3].result.isError,undefined);assert.equal((await new Store(dir).read()).records['calendar:interview'].start,'2026-11-25T10:00');
}));
