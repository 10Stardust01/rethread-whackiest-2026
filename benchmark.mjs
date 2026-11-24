import {seed,change,planUndo,applyUndo,clone} from './engine.mjs';
import fs from 'node:fs/promises';
// Transparent reference baselines, not installations or measurements of competitor products.
const patch=(s,resource,values,extra={})=>change(s,{run:'a',resource,patch:values,...extra});
const setup=(label,build,expected,scope='a')=>({label,build,expected,scope});
const cases=[
 setup('Independent later human field',s=>{patch(s,'calendar:interview',{start:'2026-11-25T14:00'});patch(s,'calendar:interview',{notes:'My later instructions'},{actor:'human',run:'me'});},s=>s.records['calendar:interview'].start==='2026-11-25T10:00'&&s.records['calendar:interview'].notes==='My later instructions'),
 setup('Overlapping human field',s=>{patch(s,'calendar:interview',{start:'2026-11-25T14:00'});patch(s,'calendar:interview',{start:'2026-11-25T15:00'},{actor:'human',run:'me'});},s=>s.records['calendar:interview'].start==='2026-11-25T15:00'),
 setup('Cross-tool dependent agent',s=>{patch(s,'calendar:interview',{start:'2026-11-25T14:00'});patch(s,'notes:travel',{route:'Taxi for 14:00 interview'},{run:'b',reads:[{resource:'calendar:interview',field:'start'}]});},s=>s.records['calendar:interview'].start==='2026-11-25T14:00'&&s.records['notes:travel'].route==='Taxi for 14:00 interview'),
 setup('Human content inside agent-created record',s=>{patch(s,'tasks:new',{title:'AI draft task'},{kind:'create'});patch(s,'tasks:new',{notes:'My new work'},{actor:'human',run:'me'});},s=>s.records['tasks:new']?.notes==='My new work'),
 setup('Unrelated later agent run',s=>{patch(s,'calendar:interview',{start:'2026-11-25T14:00'});patch(s,'notes:travel',{budget:250},{run:'b'});},s=>s.records['calendar:interview'].start==='2026-11-25T10:00'&&s.records['notes:travel'].budget===250),
 setup('Human read depends on an agent effect',s=>{patch(s,'calendar:interview',{start:'2026-11-25T14:00'});patch(s,'notes:travel',{route:'My plan for 14:00'},{actor:'human',run:'me',reads:[{resource:'calendar:interview',field:'start'}]});},s=>s.records['calendar:interview'].start==='2026-11-25T14:00'&&s.records['notes:travel'].route==='My plan for 14:00'),
 setup('No later work',s=>patch(s,'calendar:interview',{start:'2026-11-25T14:00'}),s=>s.records['calendar:interview'].start==='2026-11-25T10:00')
];
const methods={
 'Whole-state snapshot':(s,b)=>{s.records=clone(b.records);return 'applied';},
 'Field merge only':s=>{
  for(const e of [...s.events].reverse().filter(e=>e.run==='a')){
   const r=s.records[e.resource];
   if(e.kind==='create'){if(JSON.stringify(r)===JSON.stringify(e.after))delete s.records[e.resource];continue;}
   if(e.kind==='update')for(const [f,value]of Object.entries(e.after))if(r&&r[f]===value){if(e.before[f].present)r[f]=clone(e.before[f].value);else delete r[f];}
  }return 'attempted';
 },
 'ReThread narrow scope':s=>{const p=planUndo(s,'a');if(p.canApply){applyUndo(s,p);return 'applied';}return 'deferred';}
};
const observations=[];
for(const c of cases)for(const [method,run]of Object.entries(methods)){
 const s=seed(),before=clone(s);c.build(s);const outcome=run(s,before);observations.push({scenario:c.label,method,outcome,meetsScenarioExpectation:c.expected(s)});
}
const result={generatedAt:new Date().toISOString(),scope:'7 hand-authored scenario families, 21 deterministic reference-method observations. Not a competitor benchmark, user study, or novel-algorithm claim.',important:'Deferral preserves state but does not complete recovery. Expectations include deferral where changing state would invalidate dependent work.',observations};
await fs.writeFile(new URL('benchmark-results.json',import.meta.url),JSON.stringify(result,null,2));
for(const method of Object.keys(methods)){const rows=observations.filter(x=>x.method===method);console.log(`${method}: ${rows.filter(x=>x.meetsScenarioExpectation).length}/${rows.length} scenario expectations; ${rows.filter(x=>x.outcome==='deferred').length} deferred`);}
