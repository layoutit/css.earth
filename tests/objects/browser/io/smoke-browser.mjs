import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const output = "output/playwright/io";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome" });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const problems = [];
  page.on("pageerror", error => problems.push(error.message));
  page.on("response", response => { if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`); });
  await page.goto(new URL("/io/", baseUrl).href, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__io?.ready === true);
  await page.evaluate(() => {
    const motion = document.querySelector('input[name="motion"]');
    if (motion.checked) motion.click();
  });
  assert.deepEqual(await page.evaluate(() => ({
    id: window.__cssEarth.activeObjectId, mounted: window.__cssEarth.mountedObjectCount,
    leaves: document.querySelectorAll(".io-body > s").length,
    forbidden: document.querySelectorAll(".planet-stage canvas, .planet-stage svg").length,
  })), { id: "io", mounted: 1, leaves: 452, forbidden: 0 });
  const paint = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  for (const [name,controlPitch,controlYaw] of [["initial",34.23,0],["north",-90,0],["south",90,0],["opposite",0,180]]) {
    await page.evaluate(state => window.__io.camera.setState(state), {controlPitch,controlYaw,zoom:1.3});
    await paint();
    assert.equal(await page.evaluate(() => window.__io.assertStableDomIdentity()), true);
    await page.screenshot({path:`${output}/${name}.png`});
  }
  await page.evaluate(() => window.__io.lenses.select("enhanced"));
  await paint();
  assert.equal(await page.locator('.planet-stage').getAttribute('data-lens'), "enhanced");
  assert.equal(await page.evaluate(() => window.__io.assertStableDomIdentity()), true);
  await page.screenshot({path:`${output}/enhanced.png`});
  const beforeShadows = await page.locator('.io-material').evaluate(el => getComputedStyle(el).backgroundPosition);
  await page.evaluate(() => document.querySelector('input[name="shadows"]').click());
  await paint();
  assert.notEqual(await page.locator('.io-material').evaluate(el => getComputedStyle(el).backgroundImage), "none",
    "Enhanced color retains our prepared shadows");
  assert.notEqual(await page.locator('.io-material').evaluate(el => getComputedStyle(el).backgroundPosition), beforeShadows,
    "The Shadows control changes the displayed lighting frame");
  await page.evaluate(() => document.querySelector('input[name="shadows"]').click());
  await page.evaluate(() => window.__io.lenses.select("normal"));
  assert.notEqual(await page.locator('.io-material').evaluate(el => getComputedStyle(el).backgroundImage), "none",
    "Returning to Monochrome restores its existing lighting");
  await page.evaluate(() => document.querySelector('input[name="shadows"]').click());
  await paint();
  await page.screenshot({path:`${output}/shadows.png`});
  await page.evaluate(() => window.__io.camera.setState({zoom:window.__io.camera.stats().minimumZoom}));
  await paint();
  const wide = await page.evaluate(() => ({stage:window.__io.camera.state().levelOfDetail.stage,
    bodies:window.__io.camera.stats().planetarySystem.bodyCount,
    orbits:window.__io.camera.stats().systemOrbitPieceCount,
    stable:window.__io.assertStableDomIdentity()}));
  assert.equal(wide.stage,"marker");
  assert.ok(wide.bodies >= 13);
  assert.ok(wide.orbits>0);
  assert.equal(wide.stable,true);
  await page.screenshot({path:`${output}/system.png`});
  assert.deepEqual(problems,[]);
  console.log(JSON.stringify({ok:true,wide,screenshots:output}));
} finally { await browser.close(); }
