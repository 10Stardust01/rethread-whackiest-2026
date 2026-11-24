import readline from 'node:readline';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Store} from './store.mjs';
import {rpc} from './protocol.mjs';
const store=new Store(process.env.RETHREAD_DATA_DIR??path.join(path.dirname(fileURLToPath(import.meta.url)),'data'));
console.error('ReThread reference MCP server: local structured records only. No external account is connected.');
for await(const line of readline.createInterface({input:process.stdin,crlfDelay:Infinity})){
 let reply;try{if(Buffer.byteLength(line)>1048576)throw Error('oversized');reply=await rpc(store,JSON.parse(line));}
 catch{reply={jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON or oversized message'}};}
 if(reply)process.stdout.write(JSON.stringify(reply)+'\n');
}
