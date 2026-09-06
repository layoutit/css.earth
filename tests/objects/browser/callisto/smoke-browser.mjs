import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium } from "playwright";

const baseUrl = process.argv[2] ?? "http://localhost:4232";
const output = "output/playwright/callisto";
await mkdir(output,{recursive:true});
const browser = await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL ?? "chrome"});
const captures = [], problems = [];
try {
  for (const dpr of [1,2]) {
    const page = await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:dpr});
    page.on("pageerror",error => problems.push(error.message));
    page.on("response",response => {if(response.status() >= 400) problems.push(`${response.status()} ${response.url()}`);});
    await page.goto(new URL("/callisto/",baseUrl).href,{waitUntil:"networkidle"});
    await page.waitForFunction(() => window.__callisto?.ready === true);
    await page.evaluate(() => {const motion=document.querySelector('input[name="motion"]');if(motion.checked)motion.click();});
    assert.deepEqual(await page.evaluate(() => ({id:window.__cssEarth.activeObjectId,mounted:window.__cssEarth.mountedObjectCount,
      leaves:document.querySelectorAll(".callisto-body > s").length,forbidden:document.querySelectorAll(".planet-stage canvas,.planet-stage svg").length})),
      {id:"callisto",mounted:1,leaves:452,forbidden:0});
    const paint = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    for (const [name,controlPitch,controlYaw] of [["initial",40,0],["negative-pitch",-90,0],["positive-pitch",90,0],["opposite",0,180]]) {
      await page.evaluate(state => window.__callisto.camera.setState(state),{controlPitch,controlYaw,zoom:1.3});
      await paint();
      assert.equal(await page.evaluate(() => window.__callisto.assertStableDomIdentity()),true);
      const path=`${output}/${name}-dpr${dpr}.png`;
      await page.screenshot({path});
      captures.push({path,dpr,camera:await page.evaluate(() => window.__callisto.camera.state())});
    }
    const before = await page.locator(".callisto-material").evaluate(el => getComputedStyle(el).backgroundPosition);
    await page.locator('input[name="shadows"]').evaluate(el => el.click());
    await paint();
    assert.notEqual(await page.locator(".callisto-material").evaluate(el => getComputedStyle(el).backgroundPosition),before);
    assert.notEqual(await page.locator(".callisto-material").evaluate(el => getComputedStyle(el).backgroundImage),"none");
    await page.screenshot({path:`${output}/shadows-dpr${dpr}.png`});
    const parentPixels = await page.evaluate(async () => {const image=new Image();image.src="/scenes/callisto/callisto-parent-jupiter.webp";await image.decode();return image.naturalWidth;});
    assert.equal(parentPixels,1024);
    await page.evaluate(() => window.__callisto.camera.setState({zoom:window.__callisto.camera.stats().minimumZoom}));
    await paint();
    assert.equal(await page.evaluate(() => window.__callisto.camera.state().levelOfDetail.stage),"marker");
    assert.equal(await page.evaluate(() => window.__callisto.assertStableDomIdentity()),true);
    await page.close();
  }
  assert.deepEqual(problems,[]);
  const manifest=await readFile(new URL("../../../../src/planets/callisto/runtime-assets.json",import.meta.url));
  await writeFile(`${output}/capture.json`,JSON.stringify({baseUrl,cwd:process.cwd(),browser:browser.version(),viewport:{width:1440,height:900},
    runtimeManifestSha256:createHash("sha256").update(manifest).digest("hex"),captures,problems},null,2));
  console.log(JSON.stringify({ok:true,dpr:[1,2],captures:captures.length,output}));
} finally {await browser.close();}
