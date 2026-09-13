import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {createTestPage} from '../site/test/browser-observations.mts';
import {requireRecord,requireArray,requireString,requireFiniteNumber} from './source-values.mts';

// One browser and one mounted body. Capture inspected views and actual loaded
// bytes; source/registration evidence owns scientific qualification.
const [body,lens,baseUrl,baselineRef,outputDirectory,baselineAssetDirectory]=process.argv.slice(2);
if(!body||!lens||!baseUrl||!baselineRef||!outputDirectory||!/^[a-z0-9-]+$/.test(body)||!/^[a-z0-9-]+$/.test(lens))
 throw new Error('Usage: capture-surface-lens.mts BODY LENS BASE_URL BASELINE_REF OUTPUT_DIRECTORY [REGENERATED_BASELINE_ASSETS]');
const root=`src/planets/${body}`,read=async(path:string)=>requireRecord(JSON.parse(await readFile(path,'utf8')));
const hash=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
const runtime=await read(`${root}/prepared/runtime.refs.json`),assets=requireArray((await read(`${root}/runtime-assets.json`)).assets).map(value=>requireRecord(value));
const variant=requireArray(runtime.variants).map(value=>requireRecord(value)).find(v=>requireRecord(v.when).lensId===lens);
if(!variant)throw new Error('No prepared dataset');
const camera=requireRecord(requireRecord(variant.navigation).camera);
const pose={controlPitch:requireFiniteNumber(camera.controlPitch),controlYaw:requireFiniteNumber(camera.controlYaw),zoom:.8};
const oldAssets=requireArray(requireRecord(JSON.parse(execFileSync('git',['show',`${baselineRef}:${root}/runtime-assets.json`],{encoding:'utf8'}))).assets).map(value=>requireRecord(value));
const existingAssetChanges=[];
for(const old of oldAssets){
 const a=assets.find(b=>b.filename===old.filename);assert.ok(a,`Existing asset removed: ${old.filename}`);
 if(a.sha256===old.sha256)continue;
 // The matched unshaded reference must retain its delivered bytes. Rebuilding
 // older shadow banks can expose existing main/prepared drift; qualify that
 // separately against an explicit regeneration of the baseline recipe.
 assert.ok(requireString(old.filename).endsWith('-shadow@2x.webp'),'Unshaded source imagery must remain unchanged');
 assert.ok(baselineAssetDirectory,`Regenerate the main recipe to qualify ${old.filename}`);
 const baseline=await readFile(resolve(baselineAssetDirectory,requireString(old.filename)));
 assert.equal(hash(baseline),a.sha256,'Changed shadow bank must match the regenerated baseline exactly');
 existingAssetChanges.push({filename:old.filename,previousSha256:old.sha256,currentSha256:a.sha256,baselineRegeneratedSha256:hash(baseline),bytes:a.bytes});
}
await mkdir(outputDirectory,{recursive:true});
const browser=await chromium.launch({headless:true});
const reports=[];
let mobile;
try{for(const dpr of [1,2]){
 const viewport={width:1440,height:900},crop={x:360,y:80,width:720,height:660};
 const page=await createTestPage(browser,{viewport,deviceScaleFactor:dpr,reducedMotion:'reduce'});
 const errors:string[]=[],pending:Promise<void>[]=[],loaded:{filename:string;url:string;sha256:string;bytes:number}[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',response=>{
  const filename=new URL(response.url()).pathname.split('/').at(-1)??'';
  if(!filename.startsWith(`${body}-`)||!filename.includes('-surface@2x.webp')&&!filename.includes('-shadow@2x.webp'))return;
  pending.push((async()=>{assert.equal(response.status(),200,response.url());const bytes=await response.body(),expected=assets.find(a=>a.filename===filename);assert.equal(hash(bytes),expected?.sha256,filename);loaded.push({filename,url:response.url(),sha256:hash(bytes),bytes:bytes.length});})().catch(e=>{errors.push(String(e));}));
 });
 const views=[];
 try{
  const response=await page.goto(`${baseUrl}/${body}/`);assert.ok(response?.ok());
  await page.waitForFunction(id=>window.__cssEarth?.error||window.__cssEarth?.object(id)?.ready,body,{timeout:45000});
  await page.evaluate(()=>{if(window.__cssearthTest.scene().error)throw new Error(window.__cssearthTest.scene().error??'Scene failed');});
  const machines=page.getByRole('button',{name:'Machines',exact:true});
  if(await machines.getAttribute('aria-pressed')==='true')await machines.click();
  const settings=page.getByRole('button',{name:'Settings',exact:true});await settings.click();
  for(const name of ['motion','shadows']){
   const input=page.locator(`input[name="${name}"]`);if(await input.count()&&await input.isChecked())await page.locator('label').filter({has:input}).click();
  }
  await page.keyboard.press('Escape');
  for(const entry of [{name:'color',lens}]){
   await page.locator(`button[name="lens"][value="${entry.lens}"]`).click();
   await page.waitForFunction(({body,lens})=>{const o=window.__cssearthTest.object(body);return o.lens().ready&&o.lens().id===lens;},{body,lens:entry.lens});
   await page.evaluate(({body,pose})=>window.__cssearthTest.object(body).setView(pose),{body,pose});
   await page.mouse.move(1420,875);await page.waitForLoadState('networkidle');await page.evaluate(async()=>{await document.fonts.ready;});
   await page.waitForTimeout(250);
   const state=await page.evaluate(body=>{const o=window.__cssearthTest.object(body);return {url:location.href,pose:o.view().pose,settings:o.settings.state(),lens:o.lens(),stats:o.renderStats,geometry:o.runtime.geometry(),stableDom:o.assertStableDomIdentity()};},body);
   assert.equal(state.settings.shadows,false);assert.ok(state.stableDom);
   const file=`${entry.name}-dpr${dpr}.png`,buffer=await page.screenshot({path:resolve(outputDirectory,file),clip:crop,animations:'disabled'});
   views.push({name:entry.name,file,sha256:hash(buffer),...state});
   if(entry.name==='color'&&dpr===1)await page.screenshot({path:resolve(outputDirectory,'product.png'),animations:'disabled'});
  }
  const beforeDrag=await page.evaluate(body=>window.__cssearthTest.object(body).view().pose,body);
  await page.mouse.move(720,440);await page.mouse.down();await page.mouse.move(800,470,{steps:8});await page.mouse.up();
  const interaction=await page.evaluate(body=>{const o=window.__cssearthTest.object(body);return {pose:o.view().pose,stableDom:o.assertStableDomIdentity()};},body);
  assert.notDeepEqual(interaction.pose,beforeDrag);assert.ok(interaction.stableDom);
  await settings.click();const shadow=page.locator('input[name="shadows"]');if(!await shadow.isChecked())await page.locator('label').filter({has:shadow}).click();await page.keyboard.press('Escape');
  await page.waitForFunction(body=>window.__cssearthTest.object(body).runtime.selection().committed?.shadows===true,body);
  await page.waitForTimeout(150);await page.screenshot({path:resolve(outputDirectory,`oblique-shadows-dpr${dpr}.png`),clip:crop});
  await Promise.all(pending);assert.deepEqual(errors,[]);
  reports.push({dpr,viewport,crop,views,interaction,loaded,errors});
 }finally{await page.close();}
}
const phone=await createTestPage(browser,{viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,reducedMotion:'reduce'});
try{
 const errors:string[]=[];phone.on('pageerror',error=>errors.push(error.message));
 await phone.goto(`${baseUrl}/${body}/`);
 await phone.waitForFunction(body=>window.__cssEarth?.object(body)?.ready,body);
 const sheet=phone.getByRole('button',{name:'Resize information sheet',exact:true});
 if(await sheet.count()&&await sheet.getAttribute('aria-expanded')!=='true')await sheet.click();
 const row=phone.locator(`button[name="lens"][value="${lens}"]`);
 await row.click();
 await phone.waitForFunction(({body,lens})=>{const o=window.__cssearthTest.object(body);return o.lens().ready&&o.lens().id===lens;},{body,lens});
 await phone.waitForLoadState('networkidle');
 const bounds=await row.boundingBox();assert.ok(bounds);assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390);
 const state=await phone.evaluate(body=>({pageWidth:document.documentElement.scrollWidth,pose:window.__cssearthTest.object(body).view().pose,stableDom:window.__cssearthTest.object(body).assertStableDomIdentity()}),body);
 assert.ok(state.pageWidth<=390);assert.ok(state.stableDom);assert.deepEqual(errors,[]);
 const buffer=await phone.screenshot({path:resolve(outputDirectory,'mobile.png'),animations:'disabled'});
 mobile={viewport:{width:390,height:844},dpr:2,rowText:await row.innerText(),bounds,...state,sha256:hash(buffer),errors};
}finally{await phone.close();}
const sceneBefore=requireRecord(JSON.parse(execFileSync('git',['show',`${baselineRef}:${root}/prepared/scene.refs.json`],{encoding:'utf8'}))),sceneNow=await read(`${root}/prepared/scene.refs.json`);
assert.deepEqual(sceneNow.bodyLeaves,sceneBefore.bodyLeaves);assert.deepEqual(sceneNow.surfaceTriangles,sceneBefore.surfaceTriangles);
await writeFile(resolve(outputDirectory,'capture.json'),JSON.stringify({body,lens,baselineRef,baselineCommit:execFileSync('git',['rev-parse',baselineRef],{encoding:'utf8'}).trim(),
 toolSha256:hash(await readFile(import.meta.filename)),recipeSha256:hash(await readFile(`${root}/source/preparation/terrestrial.json`)),runtimeSha256:hash(await readFile(`${root}/prepared/runtime.refs.json`)),
 geometrySha256:hash(JSON.stringify(sceneNow.bodyLeaves)),surfaceTrianglesSha256:hash(JSON.stringify(sceneNow.surfaceTriangles)),geometryUnchanged:true,browser:await browser.version(),
 purpose:'Mounted-lens inspection at DPR 1 and 2, with loaded asset hashes, geometry retention and interaction checks. Scientific qualification belongs to the source and registration evidence.',existingAssetChanges,mobile,reports},null,2)+'\n');
console.log(`${body}: ${reports.length} DPR cases with retained DOM and verified assets`);
}finally{await browser.close();}
