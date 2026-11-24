import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {CalDavRecovery,patchCalendar} from './caldav.mjs';
import {calendarICS} from './exports.mjs';
import {seed} from './engine.mjs';
const origin=process.env.RETHREAD_CALDAV_ORIGIN??'http://127.0.0.1:5237';
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))throw Error('Only a disposable loopback test server is allowed');
const authorization='Basic '+Buffer.from('demo:demo').toString('base64');
const collection=origin+`/demo/rethread-${Date.now()}/`,url=collection+'interview.ics';
const mk=await fetch(collection,{method:'MKCALENDAR',headers:{authorization,'content-type':'application/xml'},body:'<?xml version="1.0"?><C:mkcalendar xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav"><D:set><D:prop><D:displayname>ReThread disposable test</D:displayname><C:supported-calendar-component-set><C:comp name="VEVENT"/></C:supported-calendar-component-set></D:prop></D:set></C:mkcalendar>'});
assert.equal(mk.status,201,'Create an isolated test calendar');
const put=await fetch(url,{method:'PUT',headers:{authorization,'content-type':'text/calendar','if-none-match':'*'},body:calendarICS(seed().records)});assert.equal(put.status,201);
const directory=path.resolve(process.env.RETHREAD_LIVE_EVIDENCE??'data/live-evidence');
const adapter=new CalDavRecovery({url,directory});
let current=await adapter.read();
const capture=await adapter.move({patch:{start:'2026-11-25T14:00'},expectedETag:current.etag});
current=await adapter.read();
// An independent direct CalDAV writer adds a note after the agent's move.
await adapter.put(patchCalendar(current.text,{notes:'Human note: use the accessible entrance'}),current.etag);
const preview=await adapter.preview(capture);assert.equal(preview.canApply,true);assert.equal(preview.outsideETagChange,true);
const restored=await adapter.undo(capture,preview);assert.equal(restored.fields.start,'2026-11-25T10:00');assert.equal(restored.fields.notes,'Human note: use the accessible entrance');
// A second run proves that a change after preview is rejected.
const second=await adapter.move({patch:{start:'2026-11-25T16:00'},expectedETag:restored.etag});
const stalePreview=await adapter.preview(second);current=await adapter.read();
const latest=await adapter.put(patchCalendar(current.text,{notes:'Even newer human note'}),current.etag);
await assert.rejects(()=>adapter.undo(second,stalePreview),/STALE/);
const afterRefusal=await adapter.read();assert.equal(afterRefusal.etag,latest.etag);assert.equal(afterRefusal.fields.notes,'Even newer human note');
// Exercise server-side If-Match itself, beyond our preflight checks.
await assert.rejects(()=>adapter.put(patchCalendar(afterRefusal.text,{notes:'Must not be written'}),stalePreview.etag),/STALE/);
current=await adapter.read();await adapter.put(patchCalendar(current.text,{start:'2026-11-25T17:00'}),current.etag);
const conflict=await adapter.preview(second);assert.equal(conflict.canApply,false);
const evidence={generatedAt:new Date().toISOString(),server:'Radicale 3.9.2',url,results:{calendarCreated:mk.status,eventCreated:put.status,agentTimeRestored:true,laterIndependentNotePreserved:true,stalePreviewRefused:true,serverIfMatchRefusedStaleWrite:true,overlappingTimeChangeBlocked:true},scope:'Real CalDAV HTTP requests with fictional data, one non-recurring Asia/Kolkata event. No browser UI or universal recovery claim. External ABA histories cannot be reconstructed from an ETag and current values.'};
await fs.mkdir(directory,{recursive:true});await fs.writeFile(path.join(directory,'live-results.json'),JSON.stringify(evidence,null,2));await fs.writeFile(path.join(directory,'recovered-event.ics'),restored.text.replace(/\n/g,'\r\n'));
console.log(JSON.stringify(evidence,null,2));
