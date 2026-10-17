import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createProxy} from './proxy.mjs';

const root=import.meta.dirname;
const port=Number(process.env.PORT||8766);
const origin=`http://127.0.0.1:${port}`;
const proxy=createProxy({origin});

function applySecurityHeaders(res){
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 res.setHeader('Cross-Origin-Resource-Policy','same-origin');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
}

http.createServer(async(req,res)=>{
 applySecurityHeaders(res);
 if(req.headers.host!==new URL(origin).host){res.writeHead(403).end('Invalid local host');return;}
 if(await proxy(req,res))return;
 let p;
 try{const rawPath=(req.url||'/').split('?')[0];p=decodeURIComponent(rawPath)}
 catch{res.writeHead(400).end('Invalid path');return;}
 if(!p.startsWith('/')||p.includes('\\')||p.split('/').some(segment=>segment==='..'||segment==='.')){res.writeHead(403).end('Forbidden');return;}
 const file=path.resolve(root,'.'+(p==='/'?'/index.html':p));
 if(!file.startsWith(root+path.sep)||p.includes('/node_modules/')){res.writeHead(403).end('Forbidden');return;}
 if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');res.writeHead(405).end('Method not allowed');return;}
 fs.stat(file,(err,s)=>{
  if(err||!s.isFile()){res.writeHead(404).end('Not found');return;}
  res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.yaml':'application/yaml; charset=utf-8','.txt':'text/plain; charset=utf-8'})[path.extname(file)]||'application/octet-stream');
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Length',String(s.size));
  if(req.method==='HEAD'){res.writeHead(200);res.end();return;}
  res.writeHead(200);
  fs.createReadStream(file).on('error',()=>{if(!res.headersSent){res.writeHead(500);res.end('Unable to read file');}else res.destroy();}).pipe(res);
 });
}).listen(port,'127.0.0.1',()=>console.log(`Instagram API catalog: ${origin}/`));
