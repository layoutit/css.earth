import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const output = "output/playwright/europa";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome" });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const problems = [];
  page.on("pageerror", error => problems.push(error.message));
  page.on("response", response => { if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`); });
  await page.goto(new URL("/europa/", baseUrl).href, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__europa?.ready === true);
  await page.evaluate(() => {
    const motion = document.querySelector('input[name="motion"]');
    if (motion.checked) motion.click();
  });
  assert.deepEqual(await page.evaluate(() => ({
    id: window.__cssEarth.activeObjectId, mounted: window.__cssEarth.mountedObjectCount,
    leaves: document.querySelectorAll(".europa-body > s").length,
    forbidden: document.querySelectorAll(".planet-stage canvas, .planet-stage svg").length,
  })), { id: "europa", mounted: 1, leaves: 452, forbidden: 0 });
  const paint = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  for (const [name,controlPitch,controlYaw] of [["initial",34.23,0],["north",-90,0],["south",90,0],["opposite",0,180]]) {
    await page.evaluate(state => window.__europa.camera.setState(state), {controlPitch,controlYaw,zoom:1.3});
    await paint();
    assert.equal(await page.evaluate(() => window.__europa.assertStableDomIdentity()), true);
    await page.screenshot({path:`${output}/${name}.png`});
  }
  await page.evaluate(() => window.__europa.lenses.select("enhanced"));
  await paint();
  assert.equal(await page.locator('.planet-stage').getAttribute('data-lens'), "enhanced");
  assert.equal(await page.evaluate(() => window.__europa.assertStableDomIdentity()), true);
  await page.screenshot({path:`${output}/enhanced.png`});
  await page.evaluate(() => window.__europa.lenses.select("normal"));
  await page.evaluate(() => document.querySelector('input[name="shadows"]').click());
  await paint();
  await page.screenshot({path:`${output}/shadows.png`});
  await page.evaluate(() => window.__europa.camera.setState({zoom:window.__europa.camera.stats().minimumZoom}));
  await paint();
  const wide = await page.evaluate(() => ({stage:window.__europa.camera.state().levelOfDetail.stage,
    bodies:window.__europa.camera.stats().planetarySystem.bodyCount,
    orbits:window.__europa.camera.stats().systemOrbitPieceCount,
    stable:window.__europa.assertStableDomIdentity()}));
  assert.equal(wide.stage,"marker");
  assert.equal(wide.bodies,13);
  assert.ok(wide.orbits>0);
  assert.equal(wide.stable,true);
  await page.screenshot({path:`${output}/system.png`});
  // Saved view that exposed the navigation tile being stretched into a
  // 269 CSS-pixel Jupiter. Its prepared photograph must cover real DPR 2.
  await page.goto(new URL("/europa/?v=MMZAwJuRwCIYxkFCxzNAAAAAP8O68XZYQ5M_4P8zC-sX77_QDskhKQ0dAAA",baseUrl).href,
    {waitUntil:"networkidle"});
  await page.waitForFunction(() => window.__europa?.ready === true);
  const parent = await page.locator('[data-body="jupiter"].planet-heliocentric-system-marker').evaluate(async element => {
    const image = new Image();
    image.src = getComputedStyle(element).backgroundImage.slice(5,-2);
    await image.decode();
    return {pixels:image.naturalWidth,diameter:element.getBoundingClientRect().width,dpr:devicePixelRatio};
  });
  assert.ok(parent.diameter > 250);
  assert.ok(parent.pixels >= parent.diameter * parent.dpr, "The parent image must not upscale at the reported view.");
  await page.screenshot({path:`${output}/jupiter-context.png`});
  assert.deepEqual(problems,[]);
  console.log(JSON.stringify({ok:true,wide,parent,screenshots:output}));
} finally { await browser.close(); }
