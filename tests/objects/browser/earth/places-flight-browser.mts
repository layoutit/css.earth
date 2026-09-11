declare global { interface Window { __flightNodes: HTMLElement[]; } }
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, type Page } from "playwright";

const base = (process.argv.slice(2).find(argument => /^https?:\/\//u.test(argument)) ?? "http://127.0.0.1:4210").replace(/\/$/u, "");
const output = new URL(`../../../../output/playwright/city-fly-to-${Date.now()}/`, import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const reports = [];
const city = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
async function select(page: Page, query: string, label: string) {
  await page.locator(".planet-sidebar-search").fill(query);
  await city(page, label).click();
  await page.locator(".planet-destination-panel").waitFor();
}
async function arrived(page: Page) {
  await page.waitForFunction(() => {
    function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }
return requiredElement(document.querySelector(".planet-destination-panel")).ariaBusy === "false"; });
}
async function frame(page: Page) {
  return page.evaluate(() => {
    function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }

    const scene = new DOMMatrix(getComputedStyle(requiredElement(document.querySelector(".polycss-scene"))).transform);
    const sky = new DOMMatrix(getComputedStyle(requiredElement(document.querySelector(".planet-cubic-sky-orientation"))).transform);
    return { scene: scene.toFloat64Array().slice(0, 12), sky: sky.toFloat64Array().slice(0, 12),
      scale: parseFloat(getComputedStyle(requiredElement(document.querySelector(".polycss-camera"))).scale) };
  });
}
try {
  for (const [label, width, height, dpr] of [["desktop-1",1440,1000,1], ["desktop-2",1440,1000,2], ["mobile-2",390,844,2]] as const) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, isMobile: width === 390, hasTouch: width === 390 });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    try {
      await page.goto(`${base}/earth/`);
      await page.waitForFunction(() => document.documentElement.dataset.ready === "true");
      await page.evaluate(() => {
        function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }
 window.__flightNodes = [...requiredElement(document.querySelector('.planet-stage')).querySelectorAll<HTMLElement>('*')]; });
      const start = await frame(page);
      await select(page, "Buenos Aires", "Buenos Aires, Buenos Aires F.D., Argentina");
      assert.match(await page.locator('.planet-destination-status').innerText(), /Flying to Buenos Aires/u);
      const first = await frame(page);
      assert.ok(first.scale / start.scale < 1.05, "Selection must not jump directly to city zoom");
      await page.waitForTimeout(650);
      const mid = await frame(page);
      assert.notDeepEqual(mid.scene, start.scene, "Camera orientation must animate");
      await page.screenshot({ path: new URL(`${label}-in-flight.png`, output).pathname });
      await arrived(page);
      assert.match(await page.locator('.planet-destination-status').innerText(), /WorldCover imagery/u);
      await page.waitForFunction(() => [...document.querySelectorAll<HTMLElement>('.earth-city-page')].some(e => e.style.visibility === 'visible' && e.style.backgroundImage.includes('blob:')));
      const end = await frame(page);
      assert.ok(end.scale / start.scale > 100);
      await page.screenshot({ path: new URL(`${label}-arrived.png`, output).pathname });
      await page.getByRole('button', { name: '← Back to Earth', exact: true }).click();
      assert.ok((await frame(page)).scale > start.scale * 50, "Return must animate too");
      await page.waitForTimeout(4800);
      assert.ok(Math.abs((await frame(page)).scale - start.scale) < .01);
      assert.equal(await page.evaluate(() => {
        function requiredElement(value: Element | null): HTMLElement { if (!(value instanceof HTMLElement)) throw new Error("Expected required HTML observation element"); return value; }

        const nodes = [...requiredElement(document.querySelector('.planet-stage')).querySelectorAll<HTMLElement>('*')];
        return nodes.length === window.__flightNodes.length && nodes.every((node, i) => node === window.__flightNodes[i]);
      }), true);
      reports.push({ label, firstScale: first.scale, startScale: start.scale, arrivalScale: end.scale, retainedScene: true, errors });
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
    console.log(`PASS ${label}: animated departure, orientation, arrival and return; stable DOM`);
  }
  const context = await browser.newContext({ viewport: { width:1440, height:1000 } });
  const page = await context.newPage();
  try {
    await page.goto(`${base}/earth/`);
    await page.waitForFunction(() => document.documentElement.dataset.ready === "true");
    // Accumulate a real drag before selecting: no Euler reset is allowed.
    await page.mouse.move(970,460);
    await page.mouse.down();
    await page.mouse.move(1120,545,{steps:20});
    await page.mouse.up();
    await select(page, "Buenos Aires", "Buenos Aires, Buenos Aires F.D., Argentina");
    await page.waitForTimeout(450);
    await page.mouse.move(1000,550);
    await page.mouse.down();
    await page.mouse.up();
    await page.getByText("Flight stopped. Select the city again to continue.", { exact:true }).waitFor();
    const stopped = await frame(page);
    await page.waitForTimeout(700);
    assert.deepEqual(await frame(page), stopped, "Pointer-down must cancel without later camera writes");
    await select(page, "Buenos Aires", "Buenos Aires, Buenos Aires F.D., Argentina");
    await page.waitForTimeout(450);
    await page.keyboard.press("Escape");
    await page.getByText("Flight stopped. Select the city again to continue.", { exact:true }).waitFor();
    await select(page, "Buenos Aires", "Buenos Aires, Buenos Aires F.D., Argentina");
    await page.waitForTimeout(450);
    await page.mouse.move(1000,550);
    await page.mouse.wheel(0, -80);
    await page.getByText("Flight stopped. Select the city again to continue.", { exact:true }).waitFor();
    // A new destination replaces the old flight; only its arrival may publish.
    await select(page, "Buenos Aires", "Buenos Aires, Buenos Aires F.D., Argentina");
    await page.waitForTimeout(350);
    await select(page, "Tokyo", "Tokyo, Tokyo, Japan");
    await arrived(page);
    assert.equal(await page.locator('.planet-destination-name').innerText(), "Tokyo");
    assert.match(await page.locator('.planet-destination-status').innerText(), /WorldCover imagery/u);
    await page.emulateMedia({ reducedMotion:"reduce" });
    await select(page, "Buenos Aires", "Buenos Aires, Buenos Aires F.D., Argentina");
    await arrived(page);
    assert.match(await page.locator('.planet-destination-status').innerText(), /WorldCover imagery/u);
    await page.emulateMedia({ reducedMotion:"no-preference" });
    await select(page, "Tokyo", "Tokyo, Tokyo, Japan");
    await page.waitForTimeout(350);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
    await page.waitForTimeout(600);
    assert.equal(await page.locator('.planet-stage > *').count(), 0);
    reports.push({ label:"interruption-and-lifecycle", pointerCancel:true, escapeCancel:true, wheelCancel:true, replacement:true, reducedMotion:true, teardown:true });
    console.log("PASS interruption after dragging, replacement, reduced motion and teardown");
  } finally { await context.close(); }
} finally {
  await browser.close();
  await writeFile(new URL('flight-report.json', output), JSON.stringify({ base, browser:"Real Google Chrome", reports }, null, 2) + '\n');
}
