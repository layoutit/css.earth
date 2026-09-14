// Headless, sequential evidence on the existing server; no server is started.
// Usage: node tests/objects/browser/asteroid-photographic-coverage.mts <itokawa|lutetia|donaldjohanson|mathilde> <before|after>
import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createTestPage} from '../../../site/test/browser-observations.mts';
import {conformanceBrowserLaunch} from '../../../site/test/conformance-browser-launch.mts';
const [id='itokawa',phase='before']=process.argv.slice(2),out=resolve('output/playwright/asteroid-photographic-coverage',id,phase);await mkdir(out,{recursive:true});
if(!['itokawa','lutetia','donaldjohanson','mathilde'].includes(id)||!['before','after'].includes(phase))throw Error('Choose itokawa, lutetia, donaldjohanson or mathilde and before or after');
const launch=await conformanceBrowserLaunch({channel:'chrome',evidenceDirectory:out,redirectStdio:true});const browser=await chromium.launch(launch.options),reports=[];
const overrides:Record<string,never>={};
try{
 const page=await createTestPage(browser,{viewport:{width:1440,height:1000},deviceScaleFactor:1});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log('console error',m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`HTTP ${r.status()} ${r.url()}`);});
 await page.goto(`http://127.0.0.1:4278/${id}/`,{waitUntil:'networkidle'});try{await page.waitForFunction(id=>window.__cssEarth?.object(id)?.ready,id,{timeout:10000});}catch(error){await page.screenshot({path:resolve(out,'loaded.png')});console.log('Loaded state',errors,await page.evaluate(()=>({keys:Object.keys(window.__cssEarth??{}),body:document.body.innerText.slice(0,1000)})));throw error;}
 await page.evaluate(()=>{const input=window.__cssearthTest.input('input[name="motion"]');if(input.checked)input.click();});
 const lens=id==='itokawa'?'amica':id==='lutetia'?'osiris':id==='mathilde'?'near-msi':'llorri';await page.locator(`button[name="dataset"][value="${lens}"]`).click();await page.waitForFunction(({id,lens})=>window.__cssearthTest.object(id).runtime.selection().committed?.lensId===lens,{id,lens});
 for(const yaw of [0,90,180,270]){await page.evaluate(({id,yaw})=>window.__cssearthTest.object(id).camera.setState({controlPitch:100,controlYaw:yaw,zoom:1.7}),{id,yaw});await page.waitForTimeout(300);await page.screenshot({path:resolve(out,`${yaw}.png`)});reports.push({yaw,camera:await page.evaluate(id=>window.__cssearthTest.object(id).camera.state(),id)});}
 const interaction:Record<string,unknown>={};
 if(phase==='after'){
  const yaw=['itokawa','donaldjohanson'].includes(id)?180:0;
  const geometry=await page.evaluateHandle(()=>[...document.querySelectorAll('.planet-stage .polycss-camera u')]);
  await page.evaluate(({id,yaw})=>{window.__cssearthTest.object(id).camera.setState({controlPitch:100,controlYaw:yaw,zoom:1.7});},{id,yaw});
  await page.waitForTimeout(300);await page.screenshot({path:resolve(out,'repeat-1.png')});await page.waitForTimeout(400);await page.screenshot({path:resolve(out,'repeat-2.png')});
  if(['donaldjohanson','mathilde'].includes(id)){
   await page.evaluate(id=>window.__cssearthTest.object(id).camera.setState(id==='mathilde'?{controlPitch:210,controlYaw:0,zoom:1.1}:{controlPitch:150,controlYaw:180,zoom:1.3}),id);
   await page.waitForTimeout(300);await page.screenshot({path:resolve(out,'hero.png')});interaction.heroCamera=await page.evaluate(id=>window.__cssearthTest.object(id).camera.state(),id);interaction.heroUrl=page.url();
   await page.evaluate(({id,yaw})=>window.__cssearthTest.object(id).camera.setState({controlPitch:100,controlYaw:yaw,zoom:1.7}),{id,yaw});
  }
  interaction.defaultShadows=await page.evaluate(()=>window.__cssearthTest.input('input[name="shadows"]').checked);if(interaction.defaultShadows!==false)throw Error('Shadows enabled by default');
  await page.evaluate(()=>window.__cssearthTest.input('input[name="shadows"]').click());await page.waitForFunction(id=>window.__cssearthTest.object(id).runtime.selection().committed?.shadows===true,id);await page.waitForTimeout(200);await page.screenshot({path:resolve(out,'shadows.png')});
  await page.evaluate(id=>window.__cssearthTest.object(id).camera.setState({controlPitch:100,controlYaw:0,zoom:1.7}),id);await page.waitForTimeout(200);await page.screenshot({path:resolve(out,'shadows-opposite.png')});
  await page.mouse.move(720,700);await page.mouse.down();await page.mouse.move(890,650,{steps:12});await page.mouse.up();
  interaction.retainedAfterDragAndLighting=await page.evaluate(nodes=>{const current=[...document.querySelectorAll('.planet-stage .polycss-camera u')];return current.length>0&&current.length===nodes.length&&current.every((n,i)=>n===nodes[i]);},geometry);
  if(!interaction.retainedAfterDragAndLighting)throw Error('Triangle DOM changed');
  interaction.cameraAfterDrag=await page.evaluate(id=>window.__cssearthTest.object(id).camera.state(),id);
  await page.setViewportSize({width:390,height:844});await page.evaluate(id=>{window.__cssearthTest.input('input[name="shadows"]').click();window.__cssearthTest.object(id).camera.setState(id==='mathilde'?{controlPitch:210,controlYaw:0,zoom:.55}:{controlPitch:100,controlYaw:180,zoom:.7});},id);await page.waitForTimeout(300);await page.screenshot({path:resolve(out,'mobile.png')});
  const hi=await createTestPage(browser,{viewport:{width:1440,height:1000},deviceScaleFactor:2});hi.on('pageerror',e=>errors.push(e.message));await hi.goto(`http://127.0.0.1:4278/${id}/`,{waitUntil:'networkidle'});await hi.waitForFunction(id=>window.__cssEarth?.object(id)?.ready,id);await hi.evaluate(()=>{const m=window.__cssearthTest.input('input[name="motion"]');if(m.checked)m.click();});await hi.locator(`button[name="dataset"][value="${lens}"]`).click();await hi.waitForFunction(({id,lens})=>window.__cssearthTest.object(id).runtime.selection().committed?.lensId===lens,{id,lens});await hi.evaluate(({id,yaw})=>window.__cssearthTest.object(id).camera.setState({controlPitch:100,controlYaw:yaw,zoom:1.7}),{id,yaw});await hi.waitForTimeout(300);await hi.screenshot({path:resolve(out,'dpr2.png')});interaction.dpr2Selection=await hi.evaluate(id=>window.__cssearthTest.object(id).runtime.selection(),id);await hi.close();
 }
 if(errors.length)throw Error(errors.join('\n'));
 await writeFile(resolve(out,'report.json'),JSON.stringify({id,phase,overrides,viewport:{width:1440,height:1000},dpr:1,browser:browser.version(),manifestHash:createHash('sha256').update(await readFile(`src/objects/${id}/runtime-assets.json`)).digest('hex'),runtimeManifest:JSON.parse(await readFile(`src/objects/${id}/runtime-assets.json`,'utf8')),reports,errors,interaction,selection:await page.evaluate(id=>window.__cssearthTest.object(id).runtime.selection(),id)},null,2));await page.close();
}finally{await browser.close();}
