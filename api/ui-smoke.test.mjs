import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

async function freePort(){
 const server=net.createServer();
 await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
 const {port}=server.address();
 await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
 return port;
}
async function waitFor(url,child){
 const until=Date.now()+10000;
 while(Date.now()<until){
  if(child.exitCode!==null)throw new Error('Local server exited before becoming ready');
  try{return await fetch(url)}catch{}
  await new Promise(r=>setTimeout(r,100));
 }
 throw new Error('Local server did not become ready');
}

test('premium workspace loads and remains navigable in desktop and mobile viewports',async t=>{
 const port=await freePort(),origin=`http://127.0.0.1:${port}`;
 const server=spawn(process.execPath,['server.mjs'],{cwd:new URL('.',import.meta.url),env:{...process.env,PORT:String(port)},stdio:'ignore'});
 let browser;
 t.after(async()=>{if(browser)await browser.close();server.kill('SIGTERM');});
 await waitFor(origin+'/',server);
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1365,height:900}});
 const pageErrors=[];
 page.on('pageerror',error=>pageErrors.push(error.message));
 await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('#live-tools',{timeout:30000});
 await page.waitForSelector('#unresolved-routes',{timeout:30000});
 await page.waitForSelector('#request-history',{timeout:30000});
 assert.match(await page.locator('.hero-copy h1').innerText(),/API research workspace/i);
 assert.equal(await page.locator('.workspace-nav a').count(),5);
 assert.equal(await page.locator('#connection-status').count(),1);
 assert.equal(await page.locator('#activity-list .activity-empty').count(),1);
 await page.locator('.workspace-nav a[href="#live-tools"]').click();
 await page.waitForFunction(()=>location.hash==='#live-tools');
 await page.setViewportSize({width:390,height:844});
 await page.locator('.hero-primary').scrollIntoViewIfNeeded();
 assert.equal(await page.locator('.workspace-hero').isVisible(),true);
 assert.equal(await page.locator('.hero-primary').isVisible(),true);
 assert.equal(await page.locator('#manual-request').count(),1);
 assert.deepEqual(pageErrors,[]);
});
