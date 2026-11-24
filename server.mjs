import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Store} from './store.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
export function createServer(store=new Store(path.join(root,'data'))){
 const token=crypto.randomBytes(24).toString('hex');
 return http.createServer(async(req,res)=>{
  const host=req.headers.host??'';
  if(!/^(127\.0\.0\.1|localhost):\d+$/.test(host)){res.writeHead(403);res.end('Local preview only');return;}
  const send=(status,data,type='application/json')=>{res.writeHead(status,{'content-type':`${type}; charset=utf-8`,'x-content-type-options':'nosniff','cache-control':'no-store','content-security-policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'"});res.end(type==='application/json'?JSON.stringify(data):data);};
  try{
   const url=new URL(req.url,`http://${host}`);
   if(req.method==='GET'&&url.pathname==='/')return send(200,await fs.readFile(path.join(root,'ReThread-investigation.html'),'utf8'),'text/html');
   if(req.method==='GET'&&url.pathname==='/api/state')return send(200,{state:await store.read(),token});
   if(req.method!=='POST')return send(404,{error:'Not found'});
   if(req.headers.origin&&req.headers.origin!==`http://${host}`)return send(403,{error:'Foreign origin refused'});
   if(req.headers['x-rethread-token']!==token)return send(403,{error:'Reload this local page before changing records'});
   if(!String(req.headers['content-type']).startsWith('application/json'))return send(415,{error:'JSON required'});
   let bytes=0,parts=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>65536)return send(413,{error:'Request too large'});parts.push(chunk);}
   const args=JSON.parse(Buffer.concat(parts).toString());
   if(url.pathname==='/api/example')return send(200,{state:await store.example(args.scenario)});
   if(url.pathname==='/api/preview')return send(200,{plan:await store.preview(args.run,args.expand)});
   if(url.pathname==='/api/undo'){const result=await store.undo(args);return send(200,{result,state:await store.read()});}
   if(url.pathname==='/api/change'){const result=await store.patch({...args,actor:'human',run:'me'});return send(200,{result,state:await store.read()});}
   return send(404,{error:'Not found'});
  }catch(e){return send(400,{error:e.message});}
 });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const server=createServer(new Store(process.env.RETHREAD_DATA_DIR??path.join(root,'data')));
 server.listen(Number(process.env.PORT??8791),'127.0.0.1',()=>console.log(`ReThread local demo: http://127.0.0.1:${server.address().port}`));
}
