import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import http from 'node:http';
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
function requestWithHost(port,host){
 return new Promise((resolve,reject)=>{
  const req=http.get({hostname:'127.0.0.1',port,path:'/',headers:{Host:host}},res=>{
   let body='';res.setEncoding('utf8');res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode,body}));
  });
  req.on('error',reject);
 });
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
 const html=await response.text();
 assert.match(html,/Instagram API — Swagger UI/);
 assert.match(html,/Your API research workspace/);
 assert.match(html,/href="#request-history"/);
 const script=await fetch(origin+'/live.mjs');
 assert.equal(script.status,200);
 assert.match(script.headers.get('content-type'),/javascript/);
 const css=await fetch(origin+'/live.css');
 assert.equal(css.status,200);
 assert.match(css.headers.get('content-type'),/text\/css/);
});
test('local server rejects foreign hosts and returns generic missing-file responses',async t=>{
 const port=await freePort(),origin=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('.',import.meta.url),env:{...process.env,PORT:String(port)},stdio:'ignore'});
 t.after(()=>child.kill('SIGTERM'));
 await waitFor(origin+'/',child);
 const foreign=await requestWithHost(port,'evil.example');
 assert.equal(foreign.status,403);
 assert.doesNotMatch(foreign.body,/\/home\/|\/workspace\/|\/Users\//);
 const missing=await fetch(origin+'/not-a-real-file');
 assert.equal(missing.status,404);
 assert.equal(missing.headers.get('x-content-type-options'),'nosniff');
});

test('static server enforces read-only methods and blocks traversal',async t=>{
 const port=await freePort(),origin=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('.',import.meta.url),env:{...process.env,PORT:String(port)},stdio:'ignore'});
 t.after(()=>child.kill('SIGTERM'));
 await waitFor(origin+'/',child);
 const post=await fetch(origin+'/',{method:'POST'});
 assert.equal(post.status,405);assert.equal(post.headers.get('allow'),'GET, HEAD');
 const traversal=await fetch(origin+'/%2e%2e/server.mjs');
 assert.equal(traversal.status,403);
 const modules=await fetch(origin+'/node_modules/swagger-ui-dist/package.json');
 assert.equal(modules.status,403);
 const head=await fetch(origin+'/',{method:'HEAD'});
 assert.equal(head.status,200);assert.equal(await head.text(),'');
 assert.ok(Number(head.headers.get('content-length'))>0);
});
