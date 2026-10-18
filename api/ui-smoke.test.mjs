import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {readFile} from 'node:fs/promises';
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
 assert.equal(await page.locator('#connection-status').getAttribute('role'),'status');
 assert.equal(await page.locator('#connection-status').getAttribute('aria-live'),'polite');
 assert.equal(await page.locator('#activity-list .activity-empty').count(),1);
 assert.equal(await page.locator('.unresolved-evidence-filter option').count(),3);
 assert.match(await page.locator('.unresolved-count').innerText(),/matching routes/i);
 await page.locator('.unresolved-filter').fill('route-filter-no-match-should-exist-0');
 assert.match(await page.locator('.unresolved-count').innerText(),/^0 matching routes/i);
 await page.locator('.unresolved-filter').fill('');
 await page.locator('.unresolved-evidence-filter').selectOption('with');
 assert.match(await page.locator('.unresolved-count').innerText(),/matching routes/i);
 await page.locator('.unresolved-evidence-filter').selectOption('all');
 const downloadPromise=page.waitForEvent('download');
 await page.locator('.unresolved-export').click();
 const download=await downloadPromise;
 assert.equal(download.suggestedFilename(),'unresolved-route-candidates.json');
 const exported=JSON.parse(await readFile(await download.path(),'utf8'));
 assert.equal(exported.liveEndpointVerification,'not performed');
 assert.ok(exported.count>0);
 assert.equal(exported.routes.length,exported.count);
 const csvDownloadPromise=page.waitForEvent('download');
 await page.locator('.unresolved-export-csv').click();
 const csvDownload=await csvDownloadPromise;
 assert.equal(csvDownload.suggestedFilename(),'unresolved-route-candidates.csv');
 const csvText=await readFile(await csvDownload.path(),'utf8');
 assert.match(csvText,/^"Route","Description","Evidence JSON"\r?\n/);
 assert.ok(csvText.split(/\r?\n/).length>2);
 assert.ok(!csvText.includes('undefined'));
 await page.locator('.workspace-nav a[href="#live-tools"]').click();
 await page.waitForFunction(()=>location.hash==='#live-tools');
 await page.locator('#manual-request summary').click();
 await page.locator('#manual-method').selectOption('POST');
 await page.locator('#manual-path').fill('/api/v1/feed/timeline/');
 let confirmationSeen=false;
 page.once('dialog',async dialog=>{confirmationSeen=true;assert.match(dialog.message(),/may change account data/i);await dialog.dismiss();});
 await page.locator('#manual-send').click();
 await page.waitForFunction(()=>document.querySelector('#live-result')?.textContent.includes('Request cancelled before sending.'));
 assert.equal(confirmationSeen,true);
 await page.setViewportSize({width:390,height:844});
 await page.locator('.hero-primary').scrollIntoViewIfNeeded();
 assert.equal(await page.locator('.workspace-hero').isVisible(),true);
 assert.equal(await page.locator('.hero-primary').isVisible(),true);
 assert.equal(await page.locator('#manual-request').count(),1);
 assert.deepEqual(pageErrors,[]);
});
