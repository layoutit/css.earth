import { sha256 } from '../src/platform/sha256.mts';
import assert from 'node:assert/strict';
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
const root=`src/objects/${body}`,read=async(path:string)=>requireRecord(JSON.parse(await readFile(path,'utf8')));

const runtime=await read(`${root}/prepared/runtime.json`),assets=requireArray((await read(`${root}/runtime-assets.json`)).assets).map(value=>requireRecord(value));
const variant=requireArray(runtime.variants).map(value=>requireRecord(value)).find(v=>requireRecord(v.when).lensId===lens);
if(!variant)throw new Error('No prepared dataset');
const navigation=variant.navigation===undefined?undefined:requireRecord(variant.navigation);
const runtimeCamera=requireRecord(runtime.camera);
const camera=navigation?.camera===undefined?{controlPitch:runtimeCamera.defaultControlPitchDegrees,controlYaw:runtimeCamera.defaultControlYawDegrees}:requireRecord(navigation.camera);
const defaultPose={controlPitch:requireFiniteNumber(camera.controlPitch),controlYaw:requireFiniteNumber(camera.controlYaw),zoom:.8};
const suppliedPose=process.env.CSSEARTH_CAPTURE_POSE;
const requestedPose=suppliedPose?requireRecord(JSON.parse(suppliedPose)):defaultPose;
const pose={controlPitch:requireFiniteNumber(requestedPose.controlPitch),controlYaw:requireFiniteNumber(requestedPose.controlYaw),zoom:requireFiniteNumber(requestedPose.zoom)};
assert.ok(pose.zoom>0,'Capture zoom must be positive');
const descriptor=await read(`${root}/object.json`);
const recipeSources=requireArray(requireRecord(requireRecord(descriptor.properties).recipe).sources).map(value=>requireRecord(value));
const surfaceRecipe=recipeSources.find(source=>source.id==='raster')??recipeSources.find(source=>source.id==='terrestrial');
assert.ok(surfaceRecipe,'No authored surface recipe');
const recipePath=`${root}/${requireString(surfaceRecipe.path)}`,recipe=await read(recipePath);
const selectedFiles=new Set([`${body}-${lens}-surface@2x.webp`,`${body}-${lens}-shadow@2x.webp`,`${body}-${lens}-thumbnail.webp`]);
// A body PR may add one dataset while improving another. Declare those exact
// lens IDs; this never permits removed assets or changes to body geometry.
const changedLenses=(process.env.CSSEARTH_CAPTURE_CHANGED_LENSES??lens).split(',');
assert.ok(changedLenses.includes(lens)&&new Set(changedLenses).size===changedLenses.length);
for(const id of changedLenses){
 assert.ok(/^[a-z0-9-]+$/.test(id)&&requireArray(runtime.variants).some(v=>requireRecord(requireRecord(v).when).lensId===id),'Changed lens must exist in the prepared runtime');
}
const changedFiles=new Set(changedLenses.flatMap(id=>[`${body}-${id}-surface@2x.webp`,`${body}-${id}-shadow@2x.webp`,`${body}-${id}-thumbnail.webp`]));
if(surfaceRecipe.id==='raster'){
 assert.deepEqual(changedLenses,[lens],'Multi-lens capture currently supports terrain atlases only');
 const surface=requireArray(recipe.surfaces).map(value=>requireRecord(value)).find(surface=>surface.id===lens);assert.ok(surface,'No selected raster surface');
 const name=(template:unknown,density=1)=>requireString(template).replaceAll('{id}',lens).replaceAll('{density}',String(density)).replaceAll('{suffix}',density===1?'':'@2x');
 selectedFiles.clear();selectedFiles.add(name(surface.thumbnail));
 assert.equal(recipe.polesCombined,false,'A selected capture needs independently bound polar assets');
 for(const density of requireArray(recipe.densities).map(value=>requireFiniteNumber(value))){selectedFiles.add(name(surface.output,density));selectedFiles.add(name(recipe.polesOutput,density));}
 changedFiles.clear();for(const filename of selectedFiles)changedFiles.add(filename);
}
const oldAssets=requireArray(requireRecord(JSON.parse(execFileSync('git',['show',`${baselineRef}:${root}/runtime-assets.json`],{encoding:'utf8',maxBuffer:32*1024*1024}))).assets).map(value=>requireRecord(value));
const existingAssetChanges=[];
for(const old of oldAssets){
 const a=assets.find(b=>b.filename===old.filename);assert.ok(a,`Existing asset removed: ${old.filename}`);
 if(a.sha256===old.sha256)continue;
 const filename=requireString(old.filename);
 if(changedFiles.has(filename)){
  existingAssetChanges.push({filename,beforeSha256:old.sha256,afterSha256:a.sha256,reason:'An explicitly declared dataset was re-prepared; its source evidence qualifies this change.'});
  continue;
 }
 // The matched unshaded reference must retain its delivered bytes. Rebuilding
 // older shadow banks can expose existing main/prepared drift; qualify that
 // separately against an explicit regeneration of the baseline recipe.
 assert.ok(requireString(old.filename).endsWith('-shadow@2x.webp'),'Unshaded source imagery must remain unchanged');
 assert.ok(baselineAssetDirectory,`Regenerate the main recipe to qualify ${old.filename}`);
 const baseline=await readFile(resolve(baselineAssetDirectory,requireString(old.filename)));
 assert.equal(sha256(baseline),a.sha256,'Changed shadow bank must match the regenerated baseline exactly');
 existingAssetChanges.push({filename:old.filename,previousSha256:old.sha256,currentSha256:a.sha256,baselineRegeneratedSha256:sha256(baseline),bytes:a.bytes});
}
await mkdir(outputDirectory,{recursive:true});
const channel=process.env.CSSEARTH_CAPTURE_CHANNEL;
if(channel!==undefined&&channel!=='chrome')throw new TypeError('The optional capture channel must be chrome.');
const browser=await chromium.launch({headless:true,...(channel?{channel}:{})});
const reports=[];
let mobile;
try{for(const dpr of [1,2]){
 const viewport={width:1440,height:900},crop={x:360,y:80,width:720,height:660};
 const page=await createTestPage(browser,{viewport,deviceScaleFactor:dpr,reducedMotion:'reduce'});
 // Retain response bodies until their hashes are recorded, including large sphere atlases.
 const network=await page.context().newCDPSession(page);
 await network.send('Network.enable',{maxTotalBufferSize:64*1024*1024,maxResourceBufferSize:16*1024*1024,enableDurableMessages:true});
 const errors:string[]=[],pending:Promise<void>[]=[],loaded:{filename:string;url:string;sha256:string;bytes:number}[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',response=>{
  const filename=new URL(response.url()).pathname.split('/').at(-1)??'';
  if(!assets.some(asset=>asset.filename===filename))return;
  // A duplicate image request can revalidate a response already hashed above.
  // A 304 contains no new image bytes; never hash it as a replacement body.
  if(response.status()===304)return;
  pending.push((async()=>{assert.equal(response.status(),200,response.url());const bytes=await response.body(),expected=assets.find(a=>a.filename===filename);assert.equal(sha256(bytes),expected?.sha256,filename);loaded.push({filename,url:response.url(),sha256:sha256(bytes),bytes:bytes.length});})().catch(e=>{errors.push(`${filename}: ${String(e)}`);}));
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
   await page.locator(`button[name="dataset"][value="${entry.lens}"]`).click();
   await page.waitForFunction(({body,lens})=>{const o=window.__cssearthTest.object(body);return o.lens().ready&&o.lens().id===lens;},{body,lens:entry.lens});
   await page.evaluate(({body,pose})=>window.__cssearthTest.object(body).setView(pose),{body,pose});
   await page.mouse.move(1420,875);await page.waitForLoadState('networkidle');await page.evaluate(async()=>{await document.fonts.ready;});
   await page.waitForTimeout(250);
   const state=await page.evaluate(body=>{const o=window.__cssearthTest.object(body);return {url:location.href,pose:o.view().pose,settings:o.settings.state(),lens:o.lens(),stats:o.renderStats,geometry:o.runtime.geometry(),stableDom:o.assertStableDomIdentity()};},body);
   assert.equal(state.settings.shadows,false);assert.ok(state.stableDom);
   const file=`${entry.name}-dpr${dpr}.png`,buffer=await page.screenshot({path:resolve(outputDirectory,file),clip:crop,animations:'disabled'});
   views.push({name:entry.name,file,sha256:sha256(buffer),...state});
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
  assert.ok(loaded.some(asset=>selectedFiles.has(asset.filename)&&!asset.filename.includes('thumbnail')&&!asset.filename.includes('-lens-')),'The selected surface must have a verified image response');
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
 const row=phone.locator(`button[name="dataset"][value="${lens}"]`);
 await row.click();
 await phone.waitForFunction(({body,lens})=>{const o=window.__cssearthTest.object(body);return o.lens().ready&&o.lens().id===lens;},{body,lens});
 await phone.evaluate(({body,pose})=>window.__cssearthTest.object(body).setView({...pose,zoom:.6}),{body,pose});
 await phone.waitForLoadState('networkidle');
 const bounds=await row.boundingBox();assert.ok(bounds);assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390);
 const state=await phone.evaluate(body=>({pageWidth:document.documentElement.scrollWidth,pose:window.__cssearthTest.object(body).view().pose,stableDom:window.__cssearthTest.object(body).assertStableDomIdentity()}),body);
 assert.ok(state.pageWidth<=390);assert.ok(state.stableDom);assert.deepEqual(errors,[]);
 const buffer=await phone.screenshot({path:resolve(outputDirectory,'mobile.png'),animations:'disabled'});
 mobile={viewport:{width:390,height:844},dpr:2,rowText:await row.innerText(),bounds,...state,sha256:sha256(buffer),errors};
}finally{await phone.close();}
const sceneBefore=requireRecord(JSON.parse(execFileSync('git',['show',`${baselineRef}:${root}/prepared/scene.json`],{encoding:'utf8',maxBuffer:32*1024*1024}))),sceneNow=await read(`${root}/prepared/scene.json`);
const geometry=sceneNow.bodyLeaves??sceneNow.body;assert.ok(geometry,'Missing prepared body geometry');
assert.deepEqual(geometry,sceneBefore.bodyLeaves??sceneBefore.body);assert.deepEqual(sceneNow.surfaceTriangles,sceneBefore.surfaceTriangles);
await writeFile(resolve(outputDirectory,'capture.json'),JSON.stringify({body,lens,changedLenses,baselineRef,baselineCommit:execFileSync('git',['rev-parse',baselineRef],{encoding:'utf8',maxBuffer:32*1024*1024}).trim(),
 toolSha256:sha256(await readFile(import.meta.filename)),colorTransferSha256:sha256(await readFile('tools/objects/color-transfer.mts')),recipeSha256:sha256(await readFile(recipePath)),runtimeSha256:sha256(await readFile(`${root}/prepared/runtime.json`)),
 geometrySha256:sha256(JSON.stringify(geometry)),...(sceneNow.surfaceTriangles?{surfaceTrianglesSha256:sha256(JSON.stringify(sceneNow.surfaceTriangles))}:{}),geometryUnchanged:true,browser:await browser.version(),channel:channel??'bundled-chromium',
 purpose:'Mounted-lens inspection at DPR 1 and 2, with loaded asset hashes, geometry retention and interaction checks. Scientific qualification belongs to the source and registration evidence.',existingAssetChanges,mobile,reports},null,2)+'\n');
console.log(`${body}: ${reports.length} DPR cases with retained DOM and verified assets`);
}finally{await browser.close();}
