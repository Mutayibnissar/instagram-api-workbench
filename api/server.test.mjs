import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {spawn} from 'node:child_process';

async function freePort(){
 const server=net.createServer();
 await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
 const {port}=server.address();
 await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
 return port;
}
async function waitFor(url,child){
 const until=Date.now()+7000;
 while(Date.now()<until){
  if(child.exitCode!==null)throw new Error('Server exited before becoming ready');
  try{return await fetch(url)}catch{}
  await new Promise(r=>setTimeout(r,100));
 }
 throw new Error('Server did not become ready');
}
test('local server serves UI with baseline browser security headers',async t=>{
 const port=await freePort(),origin=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('.',import.meta.url),env:{...process.env,PORT:String(port)},stdio:'ignore'});
 t.after(()=>child.kill('SIGTERM'));
 const response=await waitFor(origin+'/',child);
 assert.equal(response.status,200);
 assert.match(response.headers.get('content-type'),/text\/html/);
 assert.equal(response.headers.get('x-content-type-options'),'nosniff');
 assert.equal(response.headers.get('x-frame-options'),'DENY');
 assert.equal(response.headers.get('referrer-policy'),'no-referrer');
 assert.match(response.headers.get('content-security-policy'),/default-src 'self'/);
 assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);
 assert.equal(response.headers.get('cache-control'),'no-store');
 assert.match(await response.text(),/Instagram API — Swagger UI/);
});
test('local server rejects foreign hosts and returns generic missing-file responses',async t=>{
 const port=await freePort(),origin=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('.',import.meta.url),env:{...process.env,PORT:String(port)},stdio:'ignore'});
 t.after(()=>child.kill('SIGTERM'));
 await waitFor(origin+'/',child);
 const foreign=await fetch(origin+'/',{headers:{Host:'evil.example'}});
 assert.equal(foreign.status,403);
 assert.doesNotMatch(await foreign.text(),/\/home\/|\/workspace\/|\/Users\//);
 const missing=await fetch(origin+'/not-a-real-file');
 assert.equal(missing.status,404);
 assert.equal(missing.headers.get('x-content-type-options'),'nosniff');
});
