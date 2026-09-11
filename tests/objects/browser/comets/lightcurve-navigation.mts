declare global { interface Window { __cometNavigationShell: HTMLElement; } }
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const origin=process.argv[2]??'http://127.0.0.1:53135',output='output/playwright/comet-expansion-navigation';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors: string[]=[],reports=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${origin}/comet-137p/`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
 await page.evaluate(()=>{
   function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }
window.__cometNavigationShell=requiredElement(document.querySelector('.planet-sidebar'))});
 for(const [id,query] of [['comet-143p','Kowal'],['comet-162p','Siding Spring'],['comet-137p','Shoemaker']]){
  await page.getByRole('searchbox').fill(query);
  await page.locator(`a.planet-object-link[data-object-id="${id}"]`).click();
  await page.waitForFunction(id=>location.pathname===`/${id}/`&&document.querySelector<HTMLElement>('.planet-stage')?.dataset.objectId===id&&document.documentElement.dataset.ready==='true',id);
  assert.equal(await page.locator('.planet-stage > .polycss-camera').count(),1);
  assert.equal(await page.locator(`.${id}-body > u`).count(),800);
  assert.equal(await page.locator('input[name="shadows"]').isChecked(),false);
  assert.equal(await page.evaluate(()=>{
    function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }
return window.__cometNavigationShell===requiredElement(document.querySelector('.planet-sidebar')); }),true);
  await page.screenshot({path:`${output}/${id}.png`});reports.push({id,query,singleCamera:true,retainedShell:true,shadows:false});
 }
 assert.deepEqual(errors,[]);
 await writeFile(`${output}/report.json`,JSON.stringify({at:new Date().toISOString(),origin,browser:browser.version(),reports,errors},null,2)+'\n');
 console.log(JSON.stringify({searchNavigations:reports.length,retainedShell:true,shadows:false}));
}finally{await browser.close();}
