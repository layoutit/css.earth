import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {OBJECTS} from '../../../../site/objects.mjs';
import {candidates} from '../../../../tools/objects/celestia-comets/catalog.mjs';

const origin=process.argv[2]??'http://127.0.0.1:53135';
const output=resolve('output/playwright/celestia-catalog-navigation');
const selected=OBJECTS.filter(o=>candidates.some(c=>c.id===o.id));
assert.equal(selected.length,20);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[],errors=[];
try {
  for(const dpr of [1,2]) {
    const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:dpr});
    page.on('pageerror',error=>errors.push(error.message));
    for(const {id} of selected) {
      await page.goto(`${origin}/sun/?overview=solar-system`);
      await page.waitForFunction(()=>window.__cssEarth?.ready);
      await page.evaluate(id=>document.querySelector(`.planet-object-link[data-object-id="${id}"]`).click(),id);
      await page.waitForFunction(id=>window.__cssEarth?.activeObjectId===id&&window.__cssEarth.ready,id,{timeout:30000});
      const state=await page.evaluate(()=>({
        scenes:document.querySelectorAll('.planet-stage > .polycss-camera').length,
        error:window.__cssEarth.error,
        shadows:document.querySelector('input[name="shadows"]').checked,
        orbit:document.querySelector('input[name="orbit"]').checked,
        datasets:[...document.querySelectorAll('button[name="lens"]')].map(b=>b.textContent.trim()),
      }));
      assert.equal(state.scenes,1,`${id}: one mounted detailed scene`);
      assert.equal(state.error,null,`${id}: successful generic handoff`);
      assert.equal(state.shadows,false,`${id}: Shadows off`);
      assert.equal(state.orbit,false,`${id}: Orbit off`);
      assert.equal(state.datasets.length,1);
      assert.match(state.datasets[0],/Celestia/);
      if(dpr===1)await page.screenshot({path:resolve(output,`${id}.png`)});
      results.push({id,dpr,...state});
      console.log(`PASS ${id} DPR ${dpr}`);
    }
    await page.close();
  }
  assert.deepEqual(errors,[]);
} finally {
  await browser.close();
  await writeFile(resolve(output,'report.json'),JSON.stringify({origin,results,errors},null,2)+'\n');
}
