import path from 'node:path';
import {CalDavRecovery} from './caldav.mjs';
export const toolsList=[
 {name:'read_workspace',description:'Read the local calendar, task and note reference records, revisions and recorded dependencies. This is not an external account connector.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true}},
 {name:'edit_record',description:'Edit a flat local reference record and capture its prior values. Supply the current workspace revision. Read dependencies must be declared explicitly. External effects are unsupported.',inputSchema:{type:'object',properties:{run:{type:'string'},resource:{type:'string'},patch:{type:'object'},kind:{enum:['update','create','delete']},reads:{type:'array',items:{type:'object',properties:{resource:{type:'string'},field:{type:'string'}},required:['resource','field']}},expectedRevision:{type:'integer'}},required:['run','resource','expectedRevision'],additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:true}},
 {name:'preview_undo',description:'Preview restoring a selected agent run. Shows field conflicts and declared later dependencies. expand may include later agent runs; human work is never included automatically. No mutation.',inputSchema:{type:'object',properties:{run:{type:'string'},expand:{type:'boolean'}},required:['run'],additionalProperties:false},annotations:{readOnlyHint:true}},
 {name:'apply_undo',description:'Apply a previously reviewed scope at the exact expected revision. Recomputes the plan; refuses stale or conflicting plans. Only the local reference workspace is supported.',inputSchema:{type:'object',properties:{run:{type:'string'},expand:{type:'boolean'},expectedRevision:{type:'integer'}},required:['run','expectedRevision'],additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:true}},
 {name:'caldav_read',description:'Read the optional real loopback CalDAV event, current fields and ETag. Requires RETHREAD_CALDAV_URL. Separate from the reference workspace.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true}},
 {name:'caldav_change',description:'Change supported fields of the optional real CalDAV event with If-Match and a prior-state capture. Non-recurring Asia/Kolkata events without attendees, alarms or duration only.',inputSchema:{type:'object',properties:{patch:{type:'object'},expectedETag:{type:'string'}},required:['patch','expectedETag'],additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:true}},
 {name:'caldav_preview_undo',description:'Preview field recovery from a saved real-calendar capture. Independent current fields are preserved; overlapping values block. ETags do not expose unknown ABA histories.',inputSchema:{type:'object',properties:{captureId:{type:'string'}},required:['captureId'],additionalProperties:false},annotations:{readOnlyHint:true}},
 {name:'caldav_apply_undo',description:'Recover the captured fields of the optional real calendar at the exact reviewed ETag. Final If-Match rejects concurrent changes. This does not undo notifications or arbitrary calendar operations.',inputSchema:{type:'object',properties:{captureId:{type:'string'},expectedETag:{type:'string'}},required:['captureId','expectedETag'],additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:true}},
 {name:'caldav_reconcile',description:'Inspect a captured request with an unknown outcome and record whether the current fields match its before or intended after state. Does not replay a remote mutation.',inputSchema:{type:'object',properties:{captureId:{type:'string'}},required:['captureId'],additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:false}}
];
export async function callTool(store,name,args={}){
 if(!args||typeof args!=='object'||Array.isArray(args))throw Error('Arguments must be an object');
 const tool=toolsList.find(t=>t.name===name);if(!tool)throw Error('Unknown tool');
 const schema=tool.inputSchema;
 if(Object.keys(args).some(k=>!(k in schema.properties)))throw Error('Unexpected argument');
 for(const field of schema.required??[])if(!(field in args))throw Error('Missing '+field);
 if(args.expand!==undefined&&typeof args.expand!=='boolean')throw Error('expand must be boolean');
 if(name.startsWith('caldav_')){
  if(!process.env.RETHREAD_CALDAV_URL)throw Error('Optional live adapter is not configured. Set RETHREAD_CALDAV_URL to an isolated loopback event.');
  const calendar=new CalDavRecovery({url:process.env.RETHREAD_CALDAV_URL,directory:path.join(store.directory,'caldav')});
  if(name==='caldav_read')return calendar.read();
  if(name==='caldav_change')return calendar.move(args);
  const capture=await calendar.load(args.captureId);
  if(name==='caldav_reconcile')return calendar.reconcile(capture);
  const preview=await calendar.preview(capture);
  if(name==='caldav_preview_undo')return preview;
  if(preview.etag!==args.expectedETag)throw Error('STALE: Review the calendar again.');
  return calendar.undo(capture,preview);
 }
 if(name==='read_workspace')return store.read();
 if(name==='edit_record')return store.patch({...args,actor:'agent'});
 if(name==='preview_undo')return store.preview(args.run,args.expand);
 if(name==='apply_undo')return store.undo(args);
}
export async function rpc(store,msg){
 if(!msg||Array.isArray(msg)||msg.jsonrpc!=='2.0'||typeof msg.method!=='string')return {jsonrpc:'2.0',id:msg?.id??null,error:{code:-32600,message:'Invalid Request'}};
 if(msg.id===undefined)return null;
 const ok=result=>({jsonrpc:'2.0',id:msg.id,result});
 if(msg.method==='initialize')return ok({protocolVersion:'2025-11-25',capabilities:{tools:{}},serverInfo:{name:'rethread-reference',version:'0.1.0'},instructions:'Local structured reference records only. No universal undo, external account access or inferred dependencies. Read current revision before editing. Review scope before applying undo.'});
 if(msg.method==='ping')return ok({});
 if(msg.method==='tools/list')return ok({tools:toolsList});
 if(msg.method==='tools/call'){
  try{const result=await callTool(store,msg.params?.name,msg.params?.arguments);return ok({content:[{type:'text',text:JSON.stringify(result)}]});}
  catch(e){return ok({isError:true,content:[{type:'text',text:e.message}]});}
 }
 return {jsonrpc:'2.0',id:msg.id,error:{code:-32601,message:'Method not found'}};
}
