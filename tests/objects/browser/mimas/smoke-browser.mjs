import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium } from "playwright";

const baseUrl = process.argv[2] ?? "http://localhost:4232";
const output = "output/playwright/mimas";
await mkdir(output,{recursive:true});
const browser = await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL ?? "chrome"});
const scene = JSON.parse(await readFile(new URL("../../../../src/planets/mimas/prepared/scene.json",import.meta.url)));
const matrix = scene.systemTransform.slice(9,-1).split(',').map(Number);
function face(latitude, longitude, zoom = 1.3) {
  const lat = latitude * Math.PI / 180, lon = longitude * Math.PI / 180;
  // PolyCSS maps source geometry X/Y onto CSS Y/X (also checked by the surface test).
  const v = [Math.cos(lat)*Math.sin(lon), Math.cos(lat)*Math.cos(lon), Math.sin(lat)];
  const [x,y,z] = [0,1,2].map(row => matrix[row]*v[0]+matrix[row+4]*v[1]+matrix[row+8]*v[2]);
  const pitch = Math.atan2(y, Math.hypot(x,z)) * 180 / Math.PI;
  const camera = scene.camera;
  return {controlYaw: Math.atan2(-x,z)*180/Math.PI,
    controlPitch: camera.defaultControlPitchDegrees + (1-pitch/camera.initialScenePitchDegrees)*(camera.maximumControlPitchDegrees-camera.defaultControlPitchDegrees), zoom};
}
const views = [["initial",{controlPitch:40,controlYaw:0,zoom:1.3}],
  ["north-pole",face(90,0)],["south-pole",face(-90,0)],["longitude-seam",face(0,0)],
  ["herschel",face(-1.38,248.24,1.3)],["close-limb",face(-1.38,248.24,2.5)]];
const captures = [], problems = [];
try {
  for (const dpr of [1,2]) {
    const page = await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:dpr});
    page.on("pageerror",error => problems.push(error.message));
    page.on("response",response => {if(response.status() >= 400) problems.push(`${response.status()} ${response.url()}`);});
    await page.goto(new URL("/mimas/",baseUrl).href,{waitUntil:"networkidle"});
    await page.waitForFunction(() => window.__mimas?.ready === true);
    await page.evaluate(() => {const motion=document.querySelector('input[name="motion"]');if(motion.checked)motion.click();});
    assert.deepEqual(await page.evaluate(() => ({id:window.__cssEarth.activeObjectId,mounted:window.__cssEarth.mountedObjectCount,
      leaves:document.querySelectorAll(".mimas-body > s").length,forbidden:document.querySelectorAll(".planet-stage canvas,.planet-stage svg").length})),
      {id:"mimas",mounted:1,leaves:452,forbidden:0});
    const paint = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    for (const lens of ["normal", "enhanced", "elevation"]) {
    await page.evaluate(id => window.__mimas.lenses.select(id), lens);
    assert.equal(await page.locator('.planet-stage').getAttribute('data-lens'), lens);
    for (const [name,state] of views) {
      await page.evaluate(state => window.__mimas.camera.setState(state),state);
      await paint();
      assert.equal(await page.evaluate(() => window.__mimas.assertStableDomIdentity()),true);
      const path=`${output}/${lens}-${name}-dpr${dpr}.png`;
      await page.screenshot({path});
      captures.push({path,lens,dpr,camera:await page.evaluate(() => window.__mimas.camera.state())});
    }
    assert.notEqual(await page.locator(".mimas-material").evaluate(el => getComputedStyle(el).backgroundImage), "none");
    const before = await page.locator(".mimas-material").evaluate(el => getComputedStyle(el).backgroundPosition);
    await page.locator('input[name="shadows"]').evaluate(el => el.click());
    await page.waitForFunction(() => window.__mimas.material.state().lighting.rotationEnabled);
    await paint();
    assert.notEqual(await page.locator(".mimas-material").evaluate(el => getComputedStyle(el).backgroundPosition),before);
    assert.notEqual(await page.locator(".mimas-material").evaluate(el => getComputedStyle(el).backgroundImage),"none");
    await page.screenshot({path:`${output}/${lens}-shadows-dpr${dpr}.png`});
    await page.locator('input[name="shadows"]').evaluate(el => el.click());
    await page.waitForFunction(() => !window.__mimas.material.state().lighting.rotationEnabled);
    }
    await page.evaluate(() => window.__mimas.camera.setState({zoom:window.__mimas.camera.stats().minimumZoom}));
    await paint();
    assert.equal(await page.evaluate(() => window.__mimas.camera.state().levelOfDetail.stage),"marker");
    assert.equal(await page.evaluate(() => window.__mimas.assertStableDomIdentity()),true);
    await page.close();
  }
  assert.deepEqual(problems,[]);
  const manifest=await readFile(new URL("../../../../src/planets/mimas/runtime-assets.json",import.meta.url));
  await writeFile(`${output}/capture.json`,JSON.stringify({baseUrl,cwd:process.cwd(),browser:browser.version(),viewport:{width:1440,height:900},
    runtimeManifestSha256:createHash("sha256").update(manifest).digest("hex"),captures,problems},null,2));
  console.log(JSON.stringify({ok:true,dpr:[1,2],captures:captures.length,output}));
} finally {await browser.close();}
