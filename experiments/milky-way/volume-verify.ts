import { chromium } from 'playwright';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { VolumeCamera, VolumeControls, VolumeVector } from './volume-controls.js';

declare global {
  interface Window {
    polycssMilkyWay: { controls: VolumeControls; project(point: VolumeVector): readonly number[]; faces: HTMLElement[]; activeAxis(): string };
  }
}
const output = resolve('.local/milky-way-proof/volume');
const manifest = JSON.parse(await readFile(resolve(output, 'manifest.json'), 'utf8')) as { faces: number };
await mkdir(resolve(output, 'verification'), { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => { throw new Error('No canvas/WebGL in the PolyCSS proof'); };
  });
  await page.goto(pathToFileURL(resolve(output, 'index.html')).href);
  await page.waitForSelector('body[data-ready=true]');
  const snapshot = () => page.evaluate(() => window.polycssMilkyWay.controls.camera());
  const baseline = await snapshot();
  const geometry = await page.evaluate(() => {
    const faces = window.polycssMilkyWay.faces;
    return { count: faces.length, depthLevels: new Set(faces.map(face => face.dataset.center)).size,
      textures: faces.map(face => face.style.backgroundImage), matrices: faces.map(face => face.style.transform) };
  });
  assert.equal(geometry.count, manifest.faces);
  assert.ok(geometry.count >= 96, 'All three prepared spatial stacks must be mounted');
  assert.equal(geometry.depthLevels, manifest.faces);
  const evidence: Record<string, unknown> = {};
  const litPixels = async (name: string): Promise<number> => {
    const png = await page.screenshot({ path: resolve(output, 'verification', `${name}.png`), clip: { x: 180, y: 160, width: 920, height: 570 } });
    const rgb = await sharp(png).removeAlpha().raw().toBuffer();
    let lit = 0;
    for (let i = 0; i < rgb.length; i += 3) if (Math.max(rgb[i]!, rgb[i + 1]!, rgb[i + 2]!) > 12) lit++;
    return lit;
  };
  for (const name of ['above', 'oblique', 'edge', 'below', 'inside']) {
    await page.click(`[data-preset=${name}]`);
    const lit = await litPixels(name);
    assert.ok(lit > 5000, `${name} must contain actual rendered volume, not just a ready flag`);
    evidence[name] = { litPixels: lit, camera: await snapshot() };
  }
  // The destructive geometry mutation must make the EDGE pixel guarantee fail.
  await page.click('[data-preset=edge]');
  const edge = await litPixels('edge-valid');
  await page.locator('.polycss-mesh[data-axis=x]').evaluate(node => { (node as HTMLElement).style.transformStyle = 'flat'; });
  const flattened = await litPixels('edge-flat-mutation');
  assert.ok(flattened < edge * 0.1, `Flattening true depth must destroy the edge view: ${flattened}/${edge}`);
  await page.locator('.polycss-mesh[data-axis=x]').evaluate(node => { (node as HTMLElement).style.transformStyle = ''; });

  // Two retained parallel slices have different observed pan displacement.
  await page.click('[data-preset=above]');
  const centers = () => page.evaluate(() => [0, 31].map(index => {
    const face = document.querySelector(`[data-slice="z-${index}"]`);
    if (!face) throw new Error('Missing prepared slice');
    const rect = face.getBoundingClientRect();
    return (rect.left + rect.right) / 2;
  }));
  const before = await centers();
  await page.evaluate(() => window.polycssMilkyWay.controls.setCamera({ target: [0, 2, 0] }));
  const after = await centers();
  const parallax = Math.abs((after[0]! - before[0]!) - (after[1]! - before[1]!));
  assert.ok(parallax > 0.5, `Retained depths must have distinct pan parallax: ${parallax}`);
  await page.click('#reset');
  await page.mouse.move(640, 440); await page.mouse.down();
  await page.mouse.move(810, 510, { steps: 10 }); await page.mouse.up();
  const orbit = await snapshot();
  assert.notEqual(orbit.yawRadians, baseline.yawRadians);
  assert.notEqual(orbit.pitchRadians, baseline.pitchRadians);
  await page.mouse.wheel(0, -1000);
  const dolly = await snapshot();
  assert.ok(dolly.distance < orbit.distance);
  await page.keyboard.down('Shift');
  await page.mouse.move(700, 480); await page.mouse.down();
  await page.mouse.move(780, 500, { steps: 5 }); await page.mouse.up();
  await page.keyboard.up('Shift');
  const pan = await snapshot();
  assert.notDeepEqual(pan.target, dolly.target);
  await page.evaluate(() => window.polycssMilkyWay.controls.setCamera({ yawRadians: 0, pitchRadians: 0, distance: 0.2, target: [0, 0, 0] }));
  await page.locator('#viewport').focus();
  const entry = await snapshot();
  await page.keyboard.press('w');
  const travelled = await snapshot();
  assert.ok(entry.position[0] > 0 && travelled.position[0] < 0, 'Keyboard translation must cross the galaxy center');
  await page.mouse.dblclick(1170, 700);
  assert.deepEqual(await snapshot(), travelled, 'Empty double-click cannot move the camera');
  const runtime = await page.evaluate(() => {
    const faces = window.polycssMilkyWay.faces;
    const forbidden: string[] = [];
    for (const element of document.querySelectorAll<HTMLElement>('.polycss-projection,.polycss-projection *')) {
      const css = getComputedStyle(element);
      if (css.filter !== 'none' || css.clipPath !== 'none' || css.maskImage !== 'none' || css.mixBlendMode !== 'normal' || css.backgroundImage.includes('gradient')) forbidden.push(element.tagName);
    }
    return { retained: faces.every(face => face.isConnected) && faces.length === document.querySelectorAll('s[data-slice]').length,
      textures: faces.map(face => face.style.backgroundImage), matrices: faces.map(face => face.style.transform),
      forbidden, canvasSvgCount: document.querySelectorAll('canvas,svg').length };
  });
  assert.equal(runtime.retained, true);
  assert.deepEqual(runtime.textures, geometry.textures, 'Camera motion must never select full-frame angle images');
  assert.deepEqual(runtime.matrices, geometry.matrices, 'Prepared polygon geometry stays fixed during navigation');
  assert.deepEqual(runtime.forbidden, []);
  assert.equal(runtime.canvasSvgCount, 0);
  assert.deepEqual(errors, []);
  await page.click('#reset');
  await page.screenshot({ path: resolve(output, 'verification', 'interactive-proof.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: resolve(output, 'verification', 'mobile.png') });
  const report = { passed: true, preparedFaces: geometry.count, parallaxPixels: parallax,
    flatteningMutation: { edgeLitPixels: edge, flattenedLitPixels: flattened },
    controls: { orbit: true, pan: true, dolly: true, keyboardCrossesCenter: true, emptyDoubleClickInert: true },
    fixedTextures: true, fixedGeometry: true, retainedDom: true, errors, views: evidence,
    limits: 'This proves real prepared PolyCSS depth and navigation. It does not establish volume-shader visual parity or acceptable interior quality.' };
  await writeFile(resolve(output, 'verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, views: Object.keys(evidence) }));
} finally { await browser.close(); }
