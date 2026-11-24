import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {CalDavRecovery,patchCalendar} from './caldav.mjs';
const evidenceFile=path.resolve(process.argv[2]??'data/live-evidence/live-results.json');
const evidence=JSON.parse(await fs.readFile(evidenceFile,'utf8'));
const directory=path.join(path.dirname(evidenceFile),'mcp-workspace');
const child=spawn(process.execPath,[fileURLToPath(new URL('mcp.mjs',import.meta.url))],{env:{...process.env,RETHREAD_DATA_DIR:directory,RETHREAD_CALDAV_URL:evidence.url},stdio:['pipe','pipe','pipe']});
const pending=new Map();let next=0,stderr='';child.stderr.on('data',d=>stderr+=d);
readline.createInterface({input:child.stdout}).on('line',line=>{const msg=JSON.parse(line),resolver=pending.get(msg.id);if(resolver){pending.delete(msg.id);resolver(msg);}});
const request=(method,params)=>new Promise((resolve,reject)=>{const id=++next;const timer=setTimeout(()=>{pending.delete(id);reject(Error('MCP request timed out: '+stderr));},10000);pending.set(id,msg=>{clearTimeout(timer);resolve(msg);});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
const call=async(name,args={})=>{const response=await request('tools/call',{name,arguments:args});if(response.result.isError)throw Error(response.result.content[0].text);return JSON.parse(response.result.content[0].text);};
try{
 const initialized=await request('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'rethread-live-verification',version:'1'}});assert.equal(initialized.result.serverInfo.name,'rethread-reference');
 child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
 const before=await call('caldav_read');const capture=await call('caldav_change',{patch:{start:'2026-11-25T18:00'},expectedETag:before.etag});
 const reviewed=await call('caldav_preview_undo',{captureId:capture.id});assert.equal(reviewed.canApply,true);
 const direct=new CalDavRecovery({url:evidence.url,directory:path.join(path.dirname(evidenceFile),'independent-writer')});const current=await direct.read();
 await direct.put(patchCalendar(current.text,{notes:'Independent writer after MCP preview'}),current.etag);
 await assert.rejects(()=>call('caldav_apply_undo',{captureId:capture.id,expectedETag:reviewed.etag}),/STALE/);
 const fresh=await call('caldav_preview_undo',{captureId:capture.id});const recovered=await call('caldav_apply_undo',{captureId:capture.id,expectedETag:fresh.etag});
 assert.equal(recovered.fields.start,before.fields.start);assert.equal(recovered.fields.notes,'Independent writer after MCP preview');
 const actual=await direct.read();assert.equal(actual.etag,recovered.etag);
 const result={generatedAt:new Date().toISOString(),transport:'Actual MCP stdio subprocess -> real CalDAV HTTP -> Radicale persisted event',results:{initialized:true,calendarChanged:true,staleRecoveryRefused:true,priorTimeRestored:true,independentNotePreserved:true,finalRemoteETagVerified:true},scope:'One supported non-recurring fictional event. No browser UI, cross-tool transaction or production-safety claim.'};
 await fs.writeFile(path.join(path.dirname(evidenceFile),'live-mcp-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{child.stdin.end();await new Promise(resolve=>child.once('exit',resolve));}
