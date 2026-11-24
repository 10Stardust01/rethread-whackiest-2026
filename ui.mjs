const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const remote=/^https?:$/.test(location.protocol)&&Boolean(location.port);
let state=seed(),original=seed(),plan=null,token='';
async function api(route,body){const response=await fetch('/api/'+route,{method:body?'POST':'GET',headers:body?{'content-type':'application/json','x-rethread-token':token}:{},body:body?JSON.stringify(body):undefined});const value=await response.json();if(!response.ok)throw Error(value.error??'Request failed');return value;}
function save(){if(!remote)try{localStorage.setItem('rethread-investigation',JSON.stringify({state,original}));}catch{}}
function render(){
 $('records').innerHTML=Object.entries(state.records).map(([id,r])=>`<article class="record"><h3>${esc(id)}</h3><dl>${Object.entries(r).map(([f,v])=>`<dt>${esc(f)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></article>`).join('');
 $('timeline').innerHTML=state.events.map(e=>`<div class="event ${e.active?'':'inactive'}"><span class="tag">${esc(e.actor)} · ${esc(e.run)}</span><div>${esc(e.resource)} · ${esc(e.kind)}</div><div class="small">${e.dependencies?.length?'Uses '+e.dependencies.map(esc).join(', '):'No recorded earlier dependency'}${e.active?'':' · undone / ledger entry'}</div></div>`).join('')||'<p class="small">Load an example to create the AI and human edits.</p>';
 $('raw').textContent=JSON.stringify(state,null,2);save();compare();
}
function invalidate(message=''){plan=null;$('apply').disabled=true;$('plan').innerHTML='';$('notice').textContent=message;}
async function load(scenario=$('scenario').value){
 original=seed();
 if(remote)state=(await api('example',{scenario})).state;
 else {
  const revision=state.revision+1;state=seed();state.revision=revision;
  const a=(resource,patch,extra={})=>change(state,{run:'a',resource,patch,...extra});
  if(scenario==='created'){a('tasks:new',{title:'AI draft task'},{kind:'create'});a('tasks:new',{notes:'My later work must survive'},{run:'me',actor:'human'});}
  else if(scenario!=='reset'){a('calendar:interview',{start:'2026-11-25T14:00'});switch(scenario){
   case'independent':a('calendar:interview',{notes:'My later note: use the accessible entrance'},{run:'me',actor:'human'});break;
   case'overlap':a('calendar:interview',{start:'2026-11-25T15:00'},{run:'me',actor:'human'});break;
   case'dependent':a('notes:travel',{route:'Taxi for the 14:00 interview'},{run:'b',reads:[{resource:'calendar:interview',field:'start'}]});a('calendar:interview',{notes:'My later note: bring printed portfolio'},{run:'me',actor:'human'});break;
   case'human':a('notes:travel',{route:'My travel plan for 14:00'},{run:'me',actor:'human',reads:[{resource:'calendar:interview',field:'start'}]});break;
  }}
 }
 $('expand').checked=false;invalidate(scenario==='reset'?'Records reset.':'Example loaded. Nothing has been undone.');render();
}
function compare(){const snapshot=clone(original.records),p=planUndo(state,'a',{expand:$('expand').checked});let merge=clone(state.records);
 for(const e of [...state.events].reverse().filter(e=>e.active&&e.run==='a')){const r=merge[e.resource];if(e.kind==='create'){if(equal(r,e.after))delete merge[e.resource];continue;}if(e.kind==='update')for(const [f,v]of Object.entries(e.after))if(r&&equal(r[f],v)){if(e.before[f].present)r[f]=e.before[f].value;else delete r[f];}}
 const brief=r=>(r['calendar:interview']?.start??'No interview')+' · '+(r['calendar:interview']?.notes??'')+' · '+(r['notes:travel']?.route??'')+(r['tasks:new']?' · new task retained':'');
 $('comparison').innerHTML=[['Whole-state snapshot',brief(snapshot)],['Field merge only',brief(merge)],['ReThread preview',p.canApply?brief(p.result):p.selected.length?'Stops: '+[...p.dependencies.map(x=>x.reason),...p.conflicts.map(x=>x.reason)].filter((x,i,a)=>a.indexOf(x)===i).join(' '):'No active effects in this run.']].map(([a,b])=>`<tr><th>${esc(a)}</th><td>${esc(b)}</td></tr>`).join('');
}
async function preview(){
 if(remote)state=(await api('state')).state;
 plan=remote?(await api('preview',{run:'a',expand:$('expand').checked})).plan:planUndo(state,'a',{expand:$('expand').checked});
 $('apply').disabled=!plan.canApply;$('notice').textContent='Preview only. Current records are unchanged.';
 $('plan').innerHTML=`<div class="status ${plan.canApply?'':'block'}"><strong>${plan.canApply?'Ready for your review':'No changes will be applied'}</strong><div>${plan.selected.length} selected effects · runs ${plan.includedRuns.map(esc).join(', ')||'none'}</div></div>`+plan.dependencies.map(d=>`<p class="small">${esc(d.actor)} run ${esc(d.run)} uses the earlier change. ${d.actor==='human'?'Your work will not be undone automatically.':'Broaden the preview to include it, or leave everything unchanged.'}</p>`).join('')+plan.conflicts.map(c=>`<p class="small">Conflict: ${esc(c.resource)} / ${esc(c.field)}. ${esc(c.reason)}</p>`).join('')+plan.steps.map(s=>`<p class="small">${esc(s.kind)} · ${esc(s.resource)}${s.preserved.length?' · preserves '+s.preserved.map(esc).join(', '):''}</p>`).join('');render();
}
async function apply(){
 if(!plan)return;
 let result;
 if(remote){const value=await api('undo',{run:plan.run,expand:plan.expand,expectedRevision:plan.revision});state=value.state;result=value.result;}
 else result=applyUndo(state,plan);
 invalidate(`Undid ${result.undone.length} recorded effects. Inspect the remaining records.`);render();
}
const guard=fn=>async()=>{try{await fn();}catch(e){invalidate(e.message);}};
$('load').onclick=guard(()=>load());$('reset').onclick=guard(()=>load('reset'));
$('preview').onclick=guard(preview);$('apply').onclick=guard(apply);
$('expand').onchange=()=>{invalidate('Scope changed. Preview again.');compare();};
function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type})),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export-calendar').onclick=guard(()=>download('ReThread-calendar.ics',calendarICS(state.records),'text/calendar'));
$('export-tasks').onclick=guard(()=>download('ReThread-tasks.csv',tasksCSV(state.records),'text/csv'));
$('export-notes').onclick=guard(()=>download('ReThread-notes.md',notesMarkdown(state.records),'text/markdown'));
try{
 if(remote){const value=await api('state');token=value.token;state=value.state;$('mode-note').textContent='Local server mode: these reference records are saved on this computer and shared with the included MCP server. No external account, message or payment is connected.';render();}
 else{const stored=JSON.parse(localStorage.getItem('rethread-investigation'));if(stored?.state?.revision>=0&&stored.original){state=stored.state;original=stored.original;render();}else await load();}
}catch(e){if(remote)invalidate(e.message);else await load();}
