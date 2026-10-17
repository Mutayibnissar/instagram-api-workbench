import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {writeFileSync} from 'node:fs';
const child=spawn('sh',['../rea-local','--mcp'],{cwd:import.meta.dirname,stdio:['pipe','pipe','pipe']});
const pending=new Map();let id=0;
child.stderr.on('data',d=>process.stderr.write(d));
createInterface({input:child.stdout}).on('line',line=>{try{const r=JSON.parse(line);if(pending.has(r.id)){const p=pending.get(r.id);pending.delete(r.id);r.error?p.reject(r.error):p.resolve(r.result)}}catch(e){process.stderr.write(String(e)+'\n')}});
function rpc(method,params){return new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:n,method,params})+'\n')})}
await rpc('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'local-instagram-investigation',version:'1.0'}});
child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
const list=await rpc('tools/list',{});writeFileSync(new URL('tool-schemas.json',import.meta.url),JSON.stringify(list,null,2));
console.log(JSON.stringify({ready:true,android_tools:list.tools.filter(t=>t.name.includes('android')).map(t=>t.name)}));
const rl=createInterface({input:process.stdin});
for await(const line of rl){
 try{const task=JSON.parse(line);if(task.quit)break;const r=await rpc('tools/call',{name:task.name,arguments:task.args});writeFileSync(new URL(task.file+'.json',import.meta.url),JSON.stringify(r,null,2));console.log(JSON.stringify({saved:task.file,isError:r.isError,keys:Object.keys(r),preview:JSON.stringify(r).slice(0,500)}));}catch(e){console.log(JSON.stringify({error:String(e)}))}
}
rl.close();process.stdin.pause();child.stdin.end();if(child.exitCode===null)await new Promise(r=>child.once('exit',r));process.exit(0);
