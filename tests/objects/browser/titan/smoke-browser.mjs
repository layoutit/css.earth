import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium } from "playwright";

const baseUrl = process.argv[2] ?? "http://localhost:4232";
const output = "output/playwright/titan";
await mkdir(output,{recursive:true});
const browser = await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL ?? "chrome"});
const captures = [], problems = [];
try {
  for (const dpr of [1,2]) {
    const page = await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:dpr});
    page.on("pageerror",error => problems.push(error.message));
    page.on("response",response => {if(response.status() >= 400) problems.push(`${response.status()} ${response.url()}`);});
    await page.goto(new URL("/titan/",baseUrl).href,{waitUntil:"networkidle"});
    await page.waitForFunction(() => window.__titan?.ready === true);
    await page.evaluate(() => {const motion=document.querySelector('input[name="motion"]');if(motion.checked)motion.click();});
    assert.deepEqual(await page.evaluate(() => ({id:window.__cssEarth.activeObjectId,mounted:window.__cssEarth.mountedObjectCount,
      leaves:document.querySelectorAll(".titan-body > s").length,forbidden:document.querySelectorAll(".planet-stage canvas,.planet-stage svg").length})),
      {id:"titan",mounted:1,leaves:452,forbidden:0});
    const paint = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    for (const lens of ["normal", "radar"]) {
    await page.evaluate(id => window.__titan.lenses.select(id), lens);
    assert.equal(await page.locator('.planet-stage').getAttribute('data-lens'), lens);
    for (const [name,controlPitch,controlYaw] of [["initial",40,0],["negative-pitch",-90,0],["positive-pitch",90,0],["opposite",0,180]]) {
      await page.evaluate(state => window.__titan.camera.setState(state),{controlPitch,controlYaw,zoom:1.3});
      await paint();
      assert.equal(await page.evaluate(() => window.__titan.assertStableDomIdentity()),true);
      const path=`${output}/${lens}-${name}-dpr${dpr}.png`;
      await page.screenshot({path});
      captures.push({path,lens,dpr,camera:await page.evaluate(() => window.__titan.camera.state())});
    }
    const before = await page.locator(".titan-material").evaluate(el => getComputedStyle(el).backgroundPosition);
    await page.locator('input[name="shadows"]').evaluate(el => el.click());
    await paint();
    assert.notEqual(await page.locator(".titan-material").evaluate(el => getComputedStyle(el).backgroundPosition),before);
    assert.notEqual(await page.locator(".titan-material").evaluate(el => getComputedStyle(el).backgroundImage),"none");
    await page.screenshot({path:`${output}/${lens}-shadows-dpr${dpr}.png`});
    await page.locator('input[name="shadows"]').evaluate(el => el.click());
    }
    await page.evaluate(() => window.__titan.camera.setState({zoom:window.__titan.camera.stats().minimumZoom}));
    await paint();
    assert.equal(await page.evaluate(() => window.__titan.camera.state().levelOfDetail.stage),"marker");
    assert.equal(await page.evaluate(() => window.__titan.assertStableDomIdentity()),true);
    await page.close();
  }
  assert.deepEqual(problems,[]);
  const manifest=await readFile(new URL("../../../../src/planets/titan/runtime-assets.json",import.meta.url));
  await writeFile(`${output}/capture.json`,JSON.stringify({baseUrl,cwd:process.cwd(),browser:browser.version(),viewport:{width:1440,height:900},
    runtimeManifestSha256:createHash("sha256").update(manifest).digest("hex"),captures,problems},null,2));
  console.log(JSON.stringify({ok:true,dpr:[1,2],captures:captures.length,output}));
} finally {await browser.close();}
