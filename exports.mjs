const icsText=v=>String(v??'').replaceAll('\\','\\\\').replace(/\r?\n/g,'\\n').replaceAll(';','\\;').replaceAll(',','\\,');
const fold=line=>{let out='',width=0;for(const char of line){const bytes=new TextEncoder().encode(char).length;if(width+bytes>73){out+='\r\n ';width=1;}out+=char;width+=bytes;}return out;};
export function calendarICS(records){
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//ReThread//Local Reference Workspace//EN','CALSCALE:GREGORIAN'];
 for(const [id,r]of Object.entries(records).filter(([id])=>id.startsWith('calendar:'))){
  if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(r.start??''))throw Error('Calendar start must use YYYY-MM-DDTHH:MM');
  lines.push('BEGIN:VEVENT','UID:'+icsText(id)+'@rethread.local','DTSTAMP:20261124T000000Z','DTSTART;TZID=Asia/Kolkata:'+r.start.replace(/[-:]/g,'')+'00','SUMMARY:'+icsText(r.title),'LOCATION:'+icsText(r.location),'DESCRIPTION:'+icsText(r.notes),'END:VEVENT');
 }lines.push('END:VCALENDAR');return lines.map(fold).join('\r\n')+'\r\n';
}
const csvCell=v=>{let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
export function tasksCSV(records){return [['id','title','due','done'],...Object.entries(records).filter(([id])=>id.startsWith('tasks:')).map(([id,r])=>[id,r.title,r.due,r.done])].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';}
const md=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replace(/[\\`*_{}\[\]()#+.!|]/g,'\\$&');
export function notesMarkdown(records){return Object.entries(records).filter(([id])=>id.startsWith('notes:')).map(([id,r])=>'# '+md(r.title??id)+'\n\n'+Object.entries(r).filter(([f])=>f!=='title').map(([f,v])=>'- **'+md(f)+'**: '+md(v)).join('\n')).join('\n\n')+'\n';}
