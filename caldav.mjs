import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
const properties={start:'DTSTART',notes:'DESCRIPTION',title:'SUMMARY',location:'LOCATION'};
const decode=s=>s.replace(/\\[nN]/g,'\n').replace(/\\([,;\\])/g,'$1');
const encode=s=>String(s).replaceAll('\\','\\\\').replace(/\r?\n/g,'\\n').replaceAll(',','\\,').replaceAll(';','\\;');
export function inspectCalendar(text){
 const unfolded=text.replace(/\r?\n[ \t]/g,'').replaceAll('\r','');
 if((unfolded.match(/^BEGIN:VEVENT$/gm)??[]).length!==1)throw Error('Exactly one non-recurring event is supported');
 const eventText=unfolded.match(/BEGIN:VEVENT\n([\s\S]*?)\nEND:VEVENT/)?.[1];
 if(!eventText)throw Error('Invalid event boundaries');
 if(/^(RRULE|RDATE|EXDATE|RECURRENCE-ID|ATTENDEE|ORGANIZER|DTEND|DURATION)[;:]|^BEGIN:VALARM$/m.test(eventText))throw Error('Recurring, scheduled, alarm or duration-bearing events are outside this adapter');
 const fields={};
 for(const [name,p]of Object.entries(properties)){
  const hits=eventText.split('\n').filter(line=>new RegExp('^'+p+'[;:]').test(line));
  if(hits.length>1)throw Error('Duplicate calendar property');
  if(!hits.length){fields[name]='';continue;}
  const value=hits[0].slice(hits[0].indexOf(':')+1);
  if(name==='start'){
   if(!hits[0].startsWith('DTSTART;TZID=Asia/Kolkata:')||!/^\d{8}T\d{4}00$/.test(value))throw Error('Only Asia/Kolkata local events at whole-minute precision are supported');
   fields.start=`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}T${value.slice(9,11)}:${value.slice(11,13)}`;
  }else fields[name]=decode(value);
 }
 return {text:unfolded.replaceAll('\r',''),fields};
}
export function patchCalendar(text,patch){
 const parsed=inspectCalendar(text),lines=parsed.text.split('\n').filter(Boolean);
 for(const [name,value]of Object.entries(patch)){
  if(!Object.hasOwn(properties,name)||typeof value!=='string'||value.length>10000)throw Error('Unsupported calendar field');
  const property=properties[name];
  let line;
  if(name==='start'){
   if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value))throw Error('Invalid local time');
   line='DTSTART;TZID=Asia/Kolkata:'+value.replace(/[-:]/g,'')+'00';
  }else line=property+':'+encode(value);
  const begin=lines.indexOf('BEGIN:VEVENT'),end=lines.indexOf('END:VEVENT');
  const index=lines.findIndex((x,i)=>i>begin&&i<end&&new RegExp('^'+property+'[;:]').test(x));
  if(index>=0)lines[index]=line;else lines.splice(lines.indexOf('END:VEVENT'),0,line);
 }
 return lines.join('\r\n')+'\r\n';
}
export class CalDavRecovery {
 constructor({url,directory,authorization='Basic '+Buffer.from('demo:demo').toString('base64')}){
  const parsed=new URL(url);
  if(parsed.protocol!=='http:'||parsed.hostname!=='127.0.0.1'||parsed.username||parsed.password)throw Error('This demo adapter accepts only a loopback calendar server');
  this.url=url;this.directory=directory;this.authorization=authorization;
 }
 async read(){
  const r=await fetch(this.url,{headers:{authorization:this.authorization},redirect:'error',signal:AbortSignal.timeout(5000)});
  if(r.status!==200)throw Error('Calendar read returned '+r.status);
  const etag=r.headers.get('etag');if(!etag||etag.startsWith('W/'))throw Error('A strong calendar ETag is required');
  const text=await r.text();if(Buffer.byteLength(text)>1048576)throw Error('Calendar object is too large');return {etag,...inspectCalendar(text)};
 }
 async put(text,etag){
  const r=await fetch(this.url,{method:'PUT',headers:{authorization:this.authorization,'content-type':'text/calendar; charset=utf-8','if-match':etag},body:text,redirect:'error',signal:AbortSignal.timeout(5000)});
  if(r.status===412)throw Error('STALE: Calendar changed. No replacement was accepted.');
  if(![201,204].includes(r.status))throw Error('Calendar update returned '+r.status);
  return this.read();
 }
 async save(capture){
  if(!/^[0-9a-f-]{36}$/.test(capture.id))throw Error('Invalid capture identity');
  await fs.mkdir(this.directory,{recursive:true});const file=path.join(this.directory,capture.id+'.json'),temp=file+'.tmp';
  await fs.writeFile(temp,JSON.stringify(capture,null,2),{mode:0o600});await fs.rename(temp,file);
 }
 async load(id){if(!/^[0-9a-f-]{36}$/.test(id))throw Error('Invalid capture identity');const capture=JSON.parse(await fs.readFile(path.join(this.directory,id+'.json'),'utf8'));if(capture.id!==id||capture.url!==this.url)throw Error('Capture does not belong to this event');return capture;}
 async reconcile(capture){
  if(!['pending','outcome_unknown'].includes(capture.status))return capture;
  const current=await this.read(),same=(a,b)=>Object.keys(properties).every(f=>a[f]===b[f]);
  if(same(current.fields,capture.after)){capture.status='applied';capture.afterETag=current.etag;capture.resolution='Observed requested state; request attribution is not independently established';}
  else if(same(current.fields,capture.before)){capture.status='not_applied';capture.resolution='Observed captured initial state; no automatic replay';}
  else {capture.resolution='Current state differs from both captured states. Human review is required.';}
  await this.save(capture);return capture;
 }
 async move({patch,expectedETag}){
  await fs.mkdir(this.directory,{recursive:true});
  for(const name of await fs.readdir(this.directory))if(name.endsWith('.json')){
   const prior=JSON.parse(await fs.readFile(path.join(this.directory,name),'utf8'));
   if(prior.url===this.url&&['pending','outcome_unknown'].includes(prior.status))throw Error('An earlier calendar request has an unknown outcome. Reconcile its capture before another mutation.');
  }
  const current=await this.read();if(current.etag!==expectedETag)throw Error('STALE: Read the calendar again.');
  const next=patchCalendar(current.text,patch),after=inspectCalendar(next).fields;
  const capture={id:randomUUID(),url:this.url,status:'pending',before:current.fields,after,fields:Object.keys(patch),beforeETag:current.etag,createdAt:new Date().toISOString()};
  await this.save(capture);
  try{const result=await this.put(next,current.etag);capture.status='applied';capture.afterETag=result.etag;await this.save(capture);return capture;}
  catch(e){capture.status=e.message.startsWith('STALE:')?'not_applied':'outcome_unknown';capture.error=e.message;await this.save(capture);throw e;}
 }
 async preview(capture){
  if(capture.url!==this.url||capture.status!=='applied')throw Error('Only an applied capture for this event can be reviewed');
  const current=await this.read(),conflicts=capture.fields.filter(f=>current.fields[f]!==capture.after[f]);
  const patch=Object.fromEntries(capture.fields.map(f=>[f,capture.before[f]]));
  return {captureId:capture.id,etag:current.etag,conflicts,canApply:conflicts.length===0,patch,preserved:Object.keys(properties).filter(f=>!capture.fields.includes(f)),outsideETagChange:current.etag!==capture.afterETag,current:current.fields};
 }
 async undo(capture,preview){
  if(preview.captureId!==capture.id||!preview.canApply)throw Error('Recovery is not reviewed or has a conflict');
  const current=await this.read();if(current.etag!==preview.etag)throw Error('STALE: Calendar changed after preview. Review again.');
  const fresh=await this.preview(capture);if(!fresh.canApply||fresh.etag!==current.etag)throw Error('STALE: Calendar changed while preparing recovery.');
  // A final conditional PUT closes the last read/write race at the calendar server.
  const next=patchCalendar(current.text,fresh.patch),result=await this.put(next,preview.etag);
  capture.status='recovered';capture.recoveredETag=result.etag;await this.save(capture);return result;
 }
}
