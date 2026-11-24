import test from 'node:test';
import assert from 'node:assert/strict';
import {seed,change,planUndo,applyUndo,clone} from '../engine.mjs';
const agent=(s,resource,patch,extra={})=>change(s,{run:'a',resource,patch,...extra});
test('undo restores agent fields and preserves a later human field',()=>{
 const s=seed();agent(s,'calendar:interview',{start:'2026-11-25T14:00'});
 change(s,{actor:'human',run:'me',resource:'calendar:interview',patch:{notes:'Bring accessible entrance instructions'}});
 const p=planUndo(s,'a');assert.equal(p.canApply,true);applyUndo(s,p);
 assert.equal(s.records['calendar:interview'].start,'2026-11-25T10:00');assert.equal(s.records['calendar:interview'].notes,'Bring accessible entrance instructions');
});
test('same-field human edit blocks instead of overwriting',()=>{
 const s=seed();agent(s,'calendar:interview',{start:'2026-11-25T14:00'});change(s,{actor:'human',run:'me',resource:'calendar:interview',patch:{start:'2026-11-25T15:00'}});
 const before=clone(s);assert.equal(planUndo(s,'a').canApply,false);assert.throws(()=>applyUndo(s,planUndo(s,'a')));assert.deepEqual(s,before);
});
test('declared cross-tool dependency blocks narrow undo and can expand agent scope',()=>{
 const s=seed();agent(s,'calendar:interview',{start:'2026-11-25T14:00'});
 agent(s,'tasks:prepare',{due:'2026-11-25'},{run:'b',reads:[{resource:'calendar:interview',field:'start'}]});
 assert.equal(planUndo(s,'a').dependencies.length,1);assert.equal(planUndo(s,'a').canApply,false);
 const p=planUndo(s,'a',{expand:true});assert.deepEqual(p.includedRuns,['a','b']);assert.equal(p.canApply,true);applyUndo(s,p);assert.equal(s.records['tasks:prepare'].due,'2026-11-24');
});
test('expansion never undoes human work',()=>{
 const s=seed();agent(s,'calendar:interview',{start:'2026-11-25T14:00'});change(s,{actor:'human',run:'me',resource:'notes:travel',patch:{route:'Taxi'},reads:[{resource:'calendar:interview',field:'start'}]});
 assert.equal(planUndo(s,'a',{expand:true}).canApply,false);
});
test('transitive dependencies close across three tools',()=>{
 const s=seed();agent(s,'calendar:interview',{start:'2026-11-25T14:00'});
 agent(s,'tasks:prepare',{due:'2026-11-25'},{run:'b',reads:[{resource:'calendar:interview',field:'start'}]});
 agent(s,'notes:travel',{route:'Taxi'},{run:'c',reads:[{resource:'tasks:prepare',field:'due'}]});
 const p=planUndo(s,'a',{expand:true});assert.equal(p.selected.length,3);applyUndo(s,p);assert.equal(s.records['notes:travel'].route,'Metro');
});
test('unrelated later agent run remains intact',()=>{
 const s=seed();agent(s,'calendar:interview',{start:'2026-11-25T14:00'});agent(s,'notes:travel',{budget:200},{run:'b'});applyUndo(s,planUndo(s,'a'));assert.equal(s.records['notes:travel'].budget,200);
});
test('preview becomes stale after any recorded change',()=>{
 const s=seed();agent(s,'calendar:interview',{start:'2026-11-25T14:00'});const p=planUndo(s,'a');agent(s,'notes:travel',{budget:200},{run:'b'});assert.throws(()=>applyUndo(s,p),/fresh plan/);
});
test('known ABA human edit is still a conflict',()=>{
 const s=seed();agent(s,'notes:travel',{budget:200});change(s,{actor:'human',run:'me',resource:'notes:travel',patch:{budget:300}});change(s,{actor:'human',run:'me',resource:'notes:travel',patch:{budget:200}});assert.equal(planUndo(s,'a').canApply,false);
});
test('unmodified created record can be removed',()=>{
 const s=seed();agent(s,'tasks:new',{title:'New task'},{kind:'create'});applyUndo(s,planUndo(s,'a'));assert.equal(s.records['tasks:new'],undefined);
});
test('human additions to a created record prevent deletion',()=>{
 const s=seed();agent(s,'tasks:new',{title:'New task'},{kind:'create'});change(s,{actor:'human',run:'me',resource:'tasks:new',patch:{notes:'My new work'}});assert.equal(planUndo(s,'a').canApply,false);
});
test('deleted record restores only if its identity is still free',()=>{
 const s=seed();agent(s,'tasks:prepare',null,{kind:'delete'});const p=planUndo(s,'a');assert.equal(p.canApply,true);applyUndo(s,p);assert.equal(s.records['tasks:prepare'].done,false);
 const t=seed();agent(t,'tasks:prepare',null,{kind:'delete'});change(t,{actor:'human',run:'me',resource:'tasks:prepare',kind:'create',patch:{title:'Different task'}});assert.equal(planUndo(t,'a').canApply,false);
});
test('multiple edits by one run unwind in reverse order',()=>{
 const s=seed();agent(s,'notes:travel',{budget:200});agent(s,'notes:travel',{budget:300});applyUndo(s,planUndo(s,'a'));assert.equal(s.records['notes:travel'].budget,120);
});
test('new fields are removed without removing a human field',()=>{
 const s=seed();agent(s,'notes:travel',{agentNote:'AI'});change(s,{actor:'human',run:'me',resource:'notes:travel',patch:{humanNote:'Mine'}});applyUndo(s,planUndo(s,'a'));assert.equal('agentNote' in s.records['notes:travel'],false);assert.equal(s.records['notes:travel'].humanNote,'Mine');
});
test('caller cannot forge an undo result',()=>{
 const s=seed();agent(s,'notes:travel',{budget:200});const p=planUndo(s,'a');p.result={};applyUndo(s,p);assert.equal(s.records['notes:travel'].budget,120);
});
test('unknown effects and unsafe field names are refused',()=>{
 const s=seed();assert.throws(()=>agent(s,'notes:travel',{budget:200},{kind:'send_email'}));assert.throws(()=>agent(s,'notes:travel',JSON.parse('{"__proto__":"x"}')));
});
test('repeat undo is refused without changing state',()=>{
 const s=seed();agent(s,'notes:travel',{budget:200});applyUndo(s,planUndo(s,'a'));const before=clone(s);assert.throws(()=>applyUndo(s,planUndo(s,'a')));assert.deepEqual(s,before);
});
