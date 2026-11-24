// A deliberately bounded reference implementation: structured local records only.
// The planner never asks an LLM to infer an inverse or decide an overlap.
export const clone = value => structuredClone(value);
export const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
const key = (r,f) => `${r}::${f}`;
const valid = s => typeof s==='string' && /^[a-zA-Z0-9_.:-]{1,100}$/.test(s) && !['__proto__','constructor','prototype'].includes(s);
export function initialState(){return {revision:0,nextId:1,records:{},events:[],versions:{}};}
export function change(state,{run,actor='agent',resource,patch,reads=[],kind='update'}){
  if(!valid(run)||!valid(resource)||!['agent','human'].includes(actor))throw Error('Invalid change identity');
  if(!['create','update','delete'].includes(kind))throw Error('Unsupported effect. No inverse is inferred.');
  if(!Array.isArray(reads)||reads.length>100)throw Error('Invalid read set');
  const current=state.records[resource];
  if(kind==='create'&&current!==undefined)throw Error('Record already exists');
  if(kind!=='create'&&current===undefined)throw Error('Record is missing');
  if(kind!=='delete'&&(!patch||Array.isArray(patch)||typeof patch!=='object'||Object.keys(patch).length>30))throw Error('Invalid patch');
  if(kind!=='delete')for(const [f,v] of Object.entries(patch)){
    if(!valid(f)||!(v===null||typeof v==='string'||typeof v==='boolean'||(typeof v==='number'&&Number.isFinite(v))))throw Error('Only flat scalar fields are supported');
    if(typeof v==='string'&&v.length>10000)throw Error('Field too large');
  }
  const dependencies=new Set();
  for(const read of reads){
    if(!read||!valid(read.resource)||!valid(read.field))throw Error('Invalid read reference');
    const last=[...state.events].reverse().find(e=>e.active&&e.resource===read.resource&&(e.kind!=='update'||own(e.after,read.field)));
    if(last)dependencies.add(last.id);
  }
  // A write depends on the last active writer of every overwritten field.
  const fields=kind==='delete'?Object.keys(current):Object.keys(patch);
  for(const f of fields){const last=[...state.events].reverse().find(e=>e.active&&e.resource===resource&&(e.kind!=='update'||own(e.after,f)));if(last)dependencies.add(last.id);}
  const before=kind==='create'?null:kind==='delete'?clone(current):Object.fromEntries(fields.map(f=>[f,own(current,f)?{present:true,value:current[f]}:{present:false}]));
  const after=kind==='delete'?null:clone(patch);
  const event={id:`e${state.nextId++}`,run,actor,resource,kind,before,after,dependencies:[...dependencies],active:true,sequence:state.events.length};
  if(kind==='delete')delete state.records[resource];
  else state.records[resource]=kind==='create'?clone(patch):{...current,...clone(patch)};
  for(const f of fields)state.versions[key(resource,f)]=event.id;
  state.revision++;state.events.push(event);return event;
}
export function planUndo(state,run,{expand=false}={}){
  if(!valid(run))throw Error('Invalid run');
  const selected=new Set(state.events.filter(e=>e.active&&e.actor==='agent'&&e.run===run).map(e=>e.id));
  const dependencies=[];
  let changed=true;
  while(changed){changed=false;for(const e of state.events){
    if(!e.active||selected.has(e.id)||!e.dependencies.some(id=>selected.has(id)))continue;
    if(e.actor==='human'||!expand){if(!dependencies.some(d=>d.id===e.id))dependencies.push({id:e.id,run:e.run,actor:e.actor,resource:e.resource,reason:'A later action depends on a selected effect.'});}
    else {selected.add(e.id);changed=true;}
  }}
  const working=clone(state.records),steps=[],conflicts=[];
  for(const e of [...state.events].reverse().filter(e=>selected.has(e.id))){
    const current=working[e.resource];
    if(e.kind==='create'){
      if(!equal(current,e.after)){conflicts.push({event:e.id,resource:e.resource,field:'whole record',reason:'The created record was changed or removed later.'});continue;}
      delete working[e.resource];steps.push({event:e.id,resource:e.resource,kind:'delete',preserved:[]});
    }else if(e.kind==='delete'){
      if(current!==undefined){conflicts.push({event:e.id,resource:e.resource,field:'whole record',reason:'A record now occupies the original identity.'});continue;}
      working[e.resource]=clone(e.before);steps.push({event:e.id,resource:e.resource,kind:'restore',preserved:[]});
    }else {
      if(!current){conflicts.push({event:e.id,resource:e.resource,field:'whole record',reason:'The record is missing.'});continue;}
      const overlap=Object.keys(e.after).filter(f=>!own(current,f)||!equal(current[f],e.after[f]));
      // A known later writer on this field is an overlap even if the value changed back (ABA).
      for(const f of Object.keys(e.after)){
        const writer=state.versions[key(e.resource,f)];
        if(writer&&writer!==e.id&&!selected.has(writer)&&!overlap.includes(f))overlap.push(f);
      }
      if(overlap.length){for(const f of overlap)conflicts.push({event:e.id,resource:e.resource,field:f,reason:'A later writer owns a field this undo would replace.'});continue;}
      const preserved=Object.keys(current).filter(f=>!own(e.after,f));
      for(const [f,old] of Object.entries(e.before)){if(old.present)current[f]=clone(old.value);else delete current[f];}
      steps.push({event:e.id,resource:e.resource,kind:'restore fields',fields:Object.keys(e.after),preserved});
    }
  }
  return {run,revision:state.revision,expand,selected:[...selected],includedRuns:[...new Set(state.events.filter(e=>selected.has(e.id)).map(e=>e.run))],dependencies,conflicts,steps,canApply:selected.size>0&&dependencies.length===0&&conflicts.length===0,result:working};
}
export function applyUndo(state,plan){
  if(state.revision!==plan.revision)throw Error('State changed after preview. Review a fresh plan.');
  // Recompute instead of trusting a caller-supplied result or canApply flag.
  const fresh=planUndo(state,plan.run,{expand:plan.expand});
  if(!fresh.canApply)throw Error('Undo is blocked. No state was changed.');
  state.records=clone(fresh.result);
  for(const e of state.events)if(fresh.selected.includes(e.id))e.active=false;
  state.revision++;
  state.events.push({id:`e${state.nextId++}`,run:`undo:${plan.run}`,actor:'system',kind:'undo',resource:'ledger',selected:fresh.selected,active:false,sequence:state.events.length});
  // Retain the last active owner, including known later human edits.
  state.versions={};
  for(const e of state.events.filter(e=>e.active))for(const f of Object.keys(e.after??e.before??{}))state.versions[key(e.resource,f)]=e.id;
  return {undone:fresh.selected,preservedRecords:clone(state.records),revision:state.revision};
}
export function seed(){
  const state=initialState();
  state.records={
    'calendar:interview':{title:'Interview',start:'2026-11-25T10:00',location:'Office',notes:'Bring portfolio'},
    'tasks:prepare':{title:'Prepare portfolio',due:'2026-11-24',done:false},
    'notes:travel':{title:'Travel plan',route:'Metro',budget:120}
  };return state;
}
