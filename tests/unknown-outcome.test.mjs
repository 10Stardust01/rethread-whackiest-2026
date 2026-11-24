import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {CalDavRecovery} from '../caldav.mjs';
import {calendarICS} from '../exports.mjs';
import {seed} from '../engine.mjs';
test('lost response is captured as unknown and reconciled without replaying the write',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'rethread-uncertain-'));let text=calendarICS(seed().records),version=1,puts=0,drop=true;
 const server=http.createServer(async(req,res)=>{
  if(req.method==='GET'){res.writeHead(200,{etag:`"${version}"`,'content-type':'text/calendar'});res.end(text);return;}
  if(req.method==='PUT'){
   if(req.headers['if-match']!==`"${version}"`){res.writeHead(412);res.end();return;}
   const chunks=[];for await(const c of req)chunks.push(c);text=Buffer.concat(chunks).toString();version++;puts++;
   if(drop){res.destroy();return;}res.writeHead(204);res.end();return;
  }res.writeHead(405);res.end();
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const adapter=new CalDavRecovery({url:`http://127.0.0.1:${server.address().port}/event.ics`,directory:dir});
  const initial=await adapter.read();await assert.rejects(()=>adapter.move({patch:{start:'2026-11-25T14:00'},expectedETag:initial.etag}));
  const files=(await fs.readdir(dir)).filter(x=>x.endsWith('.json'));assert.equal(files.length,1);
  const capture=await adapter.load(files[0].slice(0,-5));assert.equal(capture.status,'outcome_unknown');assert.equal(puts,1);
  await assert.rejects(()=>adapter.move({patch:{start:'2026-11-25T15:00'},expectedETag:'"2"'}),/unknown outcome/);assert.equal(puts,1);
  const reconciled=await adapter.reconcile(capture);assert.equal(reconciled.status,'applied');assert.equal(puts,1);
  drop=false;const preview=await adapter.preview(reconciled);const result=await adapter.undo(reconciled,preview);assert.equal(result.fields.start,'2026-11-25T10:00');assert.equal(puts,2);
 }finally{await new Promise(resolve=>server.close(resolve));await fs.rm(dir,{recursive:true,force:true});}
});
