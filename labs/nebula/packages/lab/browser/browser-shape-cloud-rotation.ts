/** Inspect real prepared banks without starting jobs or touching the user's browser/storage. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { chromium } from 'playwright';
import { readShapeCloudResult } from '../src/features/shape-cloud/result.ts';
import type { ShapeCloudViewer } from '../src/adapters/viewer/shape-cloud-viewer';

const resultPath = process.argv[2];
if (!resultPath) throw new TypeError('Usage: run.ts browser-shape-cloud-rotation <result.json> [output-directory] [base-url]');
const result = readShapeCloudResult(JSON.parse(await readFile(resultPath, 'utf8')));
assert.ok(!result.empty && result.neutral && result.textured, 'Rotation inspection requires both prepared materials.');
const output = process.argv[3] ?? `.local/nebula-lab/shape-cloud/rotation/${result.id}`;
const base = process.argv[4] ?? 'http://127.0.0.1:4331';
const poses = [[0, 0], [30, 0], [45, 0], [60, 0], [90, 0], [45, 35]] as const;
type HarnessWindow = Window & { rotationCloud?: ShapeCloudViewer };
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const rows: unknown[] = [], images: { input: Buffer; left: number; top: number }[] = [];
try {
  const page = await browser.newPage({ viewport: { width: 768, height: 768 }, deviceScaleFactor: 1 });
  const errors: string[] = [], writes: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.method() !== 'GET') writes.push(request.method()); });
  await page.route('**/shape-cloud-rotation-fixture', route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#000}#cloud{position:absolute;inset:0;overflow:hidden}</style></head><body><div id="cloud"></div></body></html>' }));
  await page.goto(`${base}/shape-cloud-rotation-fixture`);
  await page.evaluate(async input => {
    const path = '/packages/lab/src/adapters/viewer/shape-cloud-viewer.ts';
    const { createShapeCloudViewer } = await import(path);
    const host = document.getElementById('cloud'); if (!host) throw new Error('Missing rotation viewport.');
    const scene: ShapeCloudViewer = await createShapeCloudViewer({ host, result: input, deferCommit: true });
    scene.setFraming({ zoom: 3, panX: 0, panY: 0 }); scene.commit();
    (window as HarnessWindow).rotationCloud = scene;
  }, result);
  const root = page.locator('[data-shape-cloud-root]'), original = await root.elementHandle(); assert.ok(original);
  for (const [materialIndex, material] of (['neutral', 'textured'] as const).entries()) {
    for (const [poseIndex, [yaw, pitch]] of poses.entries()) {
      await page.evaluate(({ yaw, pitch, material }) => {
        const scene = (window as HarnessWindow).rotationCloud; if (!scene) throw new Error('Rotation scene is missing.');
        scene.setMaterial(material); scene.setPose(yaw, pitch);
      }, { yaw, pitch, material });
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      assert.equal(await original.evaluate(node => node.isConnected), true, 'Rotation/material changes must retain the scene.');
      const pixelError = await page.evaluate(({ yaw, pitch, unitsPerPixel, width, height }) => {
        const camera = document.querySelector<HTMLElement>('.css-volume-camera');
        if (!camera || getComputedStyle(camera).perspective !== 'none') throw new Error('Cloud comparison must use true orthographic projection.');
        const scene = document.querySelector<HTMLElement>('.css-volume-scene'); if (!scene) throw new Error('Missing retained cloud scene.');
        const cy = Math.cos(yaw * Math.PI / 180), sy = Math.sin(yaw * Math.PI / 180);
        const cx = Math.cos(pitch * Math.PI / 180), sx = Math.sin(pitch * Math.PI / 180);
        const scale = Math.min(768 / width, 768 / height) * .94 * 3 / unitsPerPixel;
        let error = 0;
        for (const [x, y, z] of [[0, 0, 0], [2.1, -1.3, 0], [-2.1, 1.3, 4], [-2.1, 1.3, -4]]) {
          const probe = document.createElement('i');
          Object.assign(probe.style, { position: 'absolute', left: '0', top: '0', width: '0', height: '0',
            transform: `translate3d(${y! * 50}px,${x! * 50}px,${z! * 50}px)` });
          scene.append(probe); const box = probe.getBoundingClientRect(); probe.remove();
          const expected = [384 + (cy * x! - sy * z!) * scale, 384 + (sx * sy * x! - cx * y! + sx * cy * z!) * scale];
          error = Math.max(error, Math.hypot(box.x - expected[0]!, box.y - expected[1]!));
        }
        return error;
      }, { yaw, pitch, unitsPerPixel: result.unitsPerPixel, width: result.width, height: result.height });
      assert.ok(pixelError < .005, `Actual CSS projection drifted ${pixelError} pixels from the image camera.`);
      const banks = await root.locator('.css-volume-projection').evaluateAll(nodes => nodes.map((node, index) => ({ axis: ['x', 'y', 'z'][index],
        visible: getComputedStyle(node).visibility, opacity: getComputedStyle(node).opacity, leaves: node.querySelectorAll('s').length / 3 })));
      const png = await page.screenshot({ path: `${output}/${material}-${yaw}-${pitch}.png` });
      const metrics = await measure(png);
      assert.ok(metrics.signalPixels > 100 && metrics.totalLight > 100, 'Prepared cloud disappeared during rotation.');
      rows.push({ material, yaw, pitch, pixelError, banks, ...metrics });
      images.push({ input: await sharp(png).resize(256, 256).png().toBuffer(), left: poseIndex * 256, top: materialIndex * 256 });
    }
  }
  assert.deepEqual(errors, []); assert.deepEqual(writes, [], 'Rotation inspection started a processing job.');
  await sharp({ create: { width: poses.length * 256, height: 512, channels: 3, background: '#000' } }).composite(images).png().toFile(`${output}/contact-sheet.png`);
  const report = { status: 'passed', resultPath: resolve(resultPath), resultId: result.id, quality: result.quality, imageId: result.imageId,
    camera: { viewport: [768, 768], sourceFitMultiplier: 3 },
    note: 'Columns: yaw0,30,45,60,90 and yaw45/pitch35. Rows: neutral then textured. Metrics describe appearance; physical projected brightness need not be equal across angles.', rows };
  await writeFile(`${output}/rotation.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: 'passed', output, resultId: result.id, poses: poses.length, materials: 2 }));
} finally { await browser.close(); }

async function measure(png: Buffer) {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const columns = Array<number>(info.width).fill(0), scanline: number[] = [];
  let totalLight = 0, signalPixels = 0, maximum = 0, minX = info.width, minY = info.height, maxX = -1, maxY = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const index = (y * info.width + x) * info.channels;
    const light = .2126 * data[index]! + .7152 * data[index + 1]! + .0722 * data[index + 2]!;
    totalLight += light; columns[x]! += light; maximum = Math.max(maximum, light);
    if (y === Math.floor(info.height / 2)) scanline.push(Number(light.toFixed(2)));
    if (light >= 3) { signalPixels++; minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  }
  let secondDifference = 0;
  for (let i = 1; i < columns.length - 1; i++) secondDifference += Math.abs(columns[i - 1]! - 2 * columns[i]! + columns[i + 1]!);
  return { totalLight, maximum, signalPixels, signalBounds: [minX, minY, maxX, maxY],
    columnRoughness: secondDifference / Math.max(1, totalLight), centerScanline: scanline };
}
