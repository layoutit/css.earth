import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
import {runtimeAssets} from '../../../../tools/runtime-assets.mjs';
import {installRuntimeAssets} from '../../../../tools/setup.mjs';

const origin=process.argv[2]??'http://127.0.0.1:53135',out=resolve('output/playwright/67p-geology/delivery');
await mkdir(out,{recursive:true});
const files=await runtimeAssets(process.cwd(),['comet-67p']),stage=await mkdtemp(resolve(out,'fresh-assets-'));
const installation=await installRuntimeAssets(files.map(asset=>({...asset,file:resolve(stage,asset.filename)})));
assert.equal(installation.installed,files.length);assert.equal(installation.reused,0);
const pins=new Map(files.map(a=>[a.filename,a])),hash=b=>createHash('sha256').update(b).digest('hex');
const payload=await readFile('src/planets/comet-67p/prepared/object.json');
const descriptor=JSON.parse(await readFile('src/planets/comet-67p/object.json'));
assert.equal(hash(payload),descriptor.prepared.sha256);
// Reuse the same UI operations as the interactive CLI inspection.
const capture=Function('return ('+await readFile(new URL('./geology-capture.js',import.meta.url),'utf8')+')')();
const browser=await chromium.launch({channel:'chrome',headless:true}),reports=[],served=[];
let server;
async function run(base,prefix,dprs){
  const page=await browser.newPage();
  try{
    await page.goto(base+'/comet-67p/',{waitUntil:'networkidle'});
    const result=await capture(page,{screenshotPrefix:prefix,dprs});
    for(const report of result){
      assert.ok(report.transportedPrepared.some(r=>r.sha256===hash(payload)),'Browser loads exact compiled object bytes');
      for(const view of report.views)for(const a of view.atlases){
        const pin=pins.get(new URL(a.url).pathname.split('/').at(-1));
        assert.equal(a.sha256,pin.sha256);assert.equal(a.bytes,pin.bytes);
      }
      reports.push({...report,fresh:prefix.includes('fresh')});
    }
  }finally{await page.close();}
}
try{
  await run(origin,'67p-geology-production',[1,2]);
  server=createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://127.0.0.1');
      if(url.pathname.startsWith('/scenes/comet-67p/')){
        const filename=url.pathname.split('/').at(-1),pin=pins.get(filename);assert.ok(pin);
        const bytes=await readFile(resolve(stage,filename));assert.equal(hash(bytes),pin.sha256);served.push(filename);
        res.writeHead(200,{'Content-Type':'image/webp','Content-Length':bytes.length,'Cache-Control':'no-store'});res.end(bytes);
      }else{
        const response=await fetch(origin+url.pathname+url.search),bytes=Buffer.from(await response.arrayBuffer());
        res.writeHead(response.status,{'Content-Type':response.headers.get('content-type')??'application/octet-stream','Content-Length':bytes.length,'Cache-Control':'no-store'});res.end(bytes);
      }
    }catch(e){res.writeHead(500);res.end(String(e));}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  await run('http://127.0.0.1:'+server.address().port,'67p-geology-fresh',[1]);
  for(const id of ['regions','geology'])for(const mode of ['surface','shadow'])assert.ok(served.includes(`comet-67p-${id}-${mode}@2x.webp`));
  const report={capturedAt:new Date().toISOString(),preparedSha256:hash(payload),freshInstallation:{...installation,bytes:files.reduce((s,a)=>s+a.bytes,0)},freshFilesServed:[...new Set(served)].sort(),reports};
  await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({captures:reports.length,freshInstallation:report.freshInstallation,preparedSha256:hash(payload)}));
}finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
