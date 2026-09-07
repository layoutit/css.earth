import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const output = resolve('.local/milky-way-proof/volume');
const directory = resolve(output, 'verification/handoff');
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(resolve(output, 'index.html')).href);
  await page.waitForSelector('body[data-ready=true]');
  const receipts: Array<{ boundary: string; difference: number; abruptMutation: number }> = [];
  for (const [boundary, yaw, pitch, varyYaw] of [
    ['xy-above', 45, 10, true], ['xy-below', 135, -10, true],
    ['xz-above', 0, 45, false], ['xz-below', 180, -45, false],
    ['yz-above', 90, 45, false], ['yz-below', 270, -45, false],
  ] as const) {
    const differences: number[] = [];
    for (const mutation of [false, true]) {
      const captures: Buffer[] = [];
      for (const delta of [-0.1, 0.1]) {
        await page.evaluate(({ yaw, pitch, mutation }) => {
          const api = window.polycssMilkyWay;
          api.controls.setCamera({ yawRadians: yaw * Math.PI / 180, pitchRadians: pitch * Math.PI / 180,
            distance: 24, target: [0, 0, 0] });
          if (mutation) for (const branch of document.querySelectorAll<HTMLElement>('.polycss-projection')) {
            branch.style.display = branch.dataset.axis === api.activeAxis() ? 'block' : 'none';
            branch.style.opacity = '1';
          }
        }, { yaw: yaw + (varyYaw ? delta : 0), pitch: pitch + (varyYaw ? 0 : delta), mutation });
        const png = await page.screenshot({ path: resolve(directory, `${boundary}-${mutation ? 'abrupt' : 'smooth'}-${delta}.png`),
          clip: { x: 180, y: 160, width: 920, height: 570 } });
        captures.push(await sharp(png).removeAlpha().raw().toBuffer());
      }
      let difference = 0, light = 0;
      for (let index = 0; index < captures[0]!.length; index++) {
        difference += Math.abs(captures[0]![index]! - captures[1]![index]!);
        light += Math.max(captures[0]![index]!, captures[1]![index]!);
      }
      assert.ok(light > 1_000_000, 'Continuity cannot pass with blank images');
      differences.push(difference / light);
    }
    receipts.push({ boundary, difference: differences[0]!, abruptMutation: differences[1]! });
  }
  // Inspect an actual fractional-opacity projection, not just the pure-axis state.
  await page.evaluate(() => window.polycssMilkyWay.controls.setCamera({ yawRadians: 0, pitchRadians: Math.PI / 4,
    distance: 30, target: [0, 0, 0] }));
  const observedCenters = () => page.evaluate(() => [8, 24].map(index => {
    const node = document.querySelector(`[data-slice="z-${index}"]`)!;
    const rect = node.getBoundingClientRect();
    return (rect.left + rect.right) / 2;
  }));
  const before = await observedCenters();
  await page.evaluate(() => window.polycssMilkyWay.controls.setCamera({ target: [0, 2, 0] }));
  const after = await observedCenters();
  const parallax = Math.abs((after[0]! - before[0]!) - (after[1]! - before[1]!));
  const projection = await page.evaluate(() => ({
    opacity: Number(document.querySelector<HTMLElement>('.polycss-projection[data-axis=z]')!.style.opacity),
    transforms: Array.from(document.querySelectorAll<HTMLElement>('.polycss-scene'), node => node.style.transform),
  }));
  assert.ok(projection.opacity > 0 && projection.opacity < 1, 'Parallax must be checked during a real fade');
  assert.ok(parallax > 0.5, `Fade must preserve observable depth: ${parallax}px`);
  assert.equal(new Set(projection.transforms).size, 1, 'Every projection must use the same observer');
  const report = { passed: receipts.every(receipt => receipt.difference < 0.03 && receipt.abruptMutation > 0.08),
    receipts, fadeParallaxPixels: parallax, errors };
  await writeFile(resolve(output, 'verification/handoff.json'), JSON.stringify(report, null, 2));
  assert.deepEqual(errors, []);
  for (const receipt of receipts) {
    assert.ok(receipt.difference < 0.03, `${receipt.boundary} has a visible handoff jump`);
    assert.ok(receipt.abruptMutation > 0.08, `${receipt.boundary} must detect removal of the smooth handoff`);
  }
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
