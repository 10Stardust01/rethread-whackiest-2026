import fs from 'node:fs/promises';
import path from 'node:path';
import {seed,change,planUndo,applyUndo,clone} from './engine.mjs';
export class Store {
 constructor(directory){this.directory=directory;this.file=path.join(directory,'state.json');this.lock=path.join(directory,'state.lock');}
 async read(){try{return JSON.parse(await fs.readFile(this.file,'utf8'));}catch(e){if(e.code==='ENOENT')return seed();throw e;}}
 async transact(fn){
  await fs.mkdir(this.directory,{recursive:true});
  let handle;try{handle=await fs.open(this.lock,'wx');}catch(e){if(e.code==='EEXIST')throw Error('Another local writer is active, or a stopped process left a lock. No change applied.');throw e;}
  const temp=path.join(this.directory,`state-${process.pid}-${Date.now()}.tmp`);
  try{const state=await this.read(),result=await fn(state);await fs.writeFile(temp,JSON.stringify(state,null,2),{mode:0o600});await fs.rename(temp,this.file);return result;}
  finally{await handle.close();await fs.rm(this.lock,{force:true});await fs.rm(temp,{force:true});}
 }
 async patch(args){return this.transact(s=>{
  if(!Number.isInteger(args.expectedRevision)||args.expectedRevision!==s.revision)throw Error('State changed. Read the records again before editing.');
  return clone(change(s,args));
 });}
 async preview(run,expand=false){return planUndo(await this.read(),run,{expand});}
 async undo({run,expand=false,expectedRevision}){return this.transact(s=>{
  if(!Number.isInteger(expectedRevision)||expectedRevision!==s.revision)throw Error('State changed after preview. Review a fresh plan.');
  return applyUndo(s,planUndo(s,run,{expand}));
 });}
 async example(scenario){return this.transact(s=>{
  const revision=s.revision+1,fresh=seed();Object.keys(s).forEach(k=>delete s[k]);Object.assign(s,fresh);s.revision=revision;
  const edit=(resource,patch,extra={})=>change(s,{run:'a',resource,patch,...extra});
  if(scenario==='reset')return clone(s);
  if(scenario==='created'){edit('tasks:new',{title:'AI draft task'},{kind:'create'});edit('tasks:new',{notes:'My later work must survive'},{run:'me',actor:'human'});return clone(s);}
  if(!['independent','overlap','dependent','human'].includes(scenario))throw Error('Unknown example');
  edit('calendar:interview',{start:'2026-11-25T14:00'});
  if(scenario==='independent')edit('calendar:interview',{notes:'My later note: use the accessible entrance'},{run:'me',actor:'human'});
  if(scenario==='overlap')edit('calendar:interview',{start:'2026-11-25T15:00'},{run:'me',actor:'human'});
  if(scenario==='dependent'){edit('notes:travel',{route:'Taxi for the 14:00 interview'},{run:'b',reads:[{resource:'calendar:interview',field:'start'}]});edit('calendar:interview',{notes:'My later note: bring printed portfolio'},{run:'me',actor:'human'});}
  if(scenario==='human')edit('notes:travel',{route:'My travel plan for 14:00'},{run:'me',actor:'human',reads:[{resource:'calendar:interview',field:'start'}]});
  return clone(s);
 });}
}
