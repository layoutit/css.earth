#!/usr/bin/env node
/** Offline renders of the delivered body, including prepared rings and atmosphere. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { requireRecord, requireFiniteNumber, requireString, isRecord } from '@cssearth/core';
import { sha256 } from '@cssearth/core/node';
import { writeLossyWebp } from '@cssearth/bake/raster';
import { preparedDefaultViewRotation, worldCameraFromCenteredPresentation } from '@cssearth/renderer/navigation';
import { parseArrivalBillboard } from '@cssearth/objects';
import { readInventory, readPreparedObjects, updateInventory } from '@cssearth/objects/node';

const root = resolve(import.meta.dirname, '../../..'), args = process.argv.slice(2);
const SCENE_OBJECTS = readPreparedObjects(root).sceneObjects;
function option(flag: string, fallback: string) {
  const at = args.indexOf(flag);
  if (at < 0) return fallback;
  const value = args[at + 1];
  if (!value || value.startsWith('--')) throw new Error(`${flag} needs a value.`);
  args.splice(at, 2); return value;
}
const origin = option('--origin', 'http://127.0.0.1:4212'), size = Number(option('--size', '1024'));
const output = resolve(root, option('--output', 'output/billboards/arrival-batch'));
// Record one prepared perspective. The arrival uses this distance and orientation,
// with optical framing to fit each viewport, then reveals the detail without a second zoom.
const distanceRadii = Number(option('--distance-radii', '8'));
const all = args.includes('--all'), force = args.includes('--force');
const ids = args.filter(arg => !['--all', '--force'].includes(arg));
if ((!all && !ids.length) || ids.some(id => id.startsWith('-')) || !Number.isInteger(size) || size < 64 || size > 2048 || !(distanceRadii > 1))
  throw new Error('Usage: pnpm prepare:arrival-billboards --all | <body>... [--origin URL] [--size 1024] [--force]');
const objects = SCENE_OBJECTS.filter(object => all || ids.includes(object.id));
for (const id of ids) if (!objects.some(object => object.id === id)) throw new Error(`Unknown scene: ${id}`);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const reports: unknown[] = [], failures: string[] = [], captureSize = 4096;
try {
  for (const [index, object] of objects.entries()) {
    const objectDirectory = resolve(root, 'src/objects', object.id), prepared = resolve(objectDirectory, 'prepared');
    const runtimeBytes = await readFile(resolve(prepared, 'runtime.json'));
    const runtime = requireRecord(JSON.parse(runtimeBytes.toString('utf8')));
    const rotation = preparedDefaultViewRotation(runtime.camera);
    const controls = requireRecord(requireRecord(runtime.controls).lenses);
    const lens = requireString(controls.defaultLens);
    let distanceM = object.worldFrame.bodyRadiusM * distanceRadii;
    const filename = `${object.id}-arrival.webp`, receiptPath = resolve(output, `${object.id}.json`);
    const identity = { runtime: sha256(runtimeBytes), size, distanceRadii, version: 3 };
    if (!force) {
      const previous: unknown = await readFile(receiptPath, 'utf8').then(JSON.parse, () => null);
      if (isRecord(previous) && JSON.stringify(previous.identity) === JSON.stringify(identity)) {
        const inventory = await readInventory(object.id, objectDirectory);
        const assets = inventory?.assets.filter(asset => asset.location === 'public' && asset.filename === filename ||
          asset.location === 'prepared' && asset.filename === 'arrival-billboard.json') ?? [];
        const intact = assets.length === 2 && (await Promise.all(assets.map(async asset => {
          const path = resolve(asset.location === 'public' ? resolve(root, 'public/scenes', object.id) : prepared, asset.filename);
          const bytes = await readFile(path).catch(() => null);
          return bytes !== null && bytes.length === asset.bytes && sha256(bytes) === asset.sha256;
        }))).every(Boolean);
        if (intact) { reports.push(previous); console.log(`[${index + 1}/${objects.length}] ${object.id}: already prepared`); continue; }
      }
    }
    const context = await browser.newContext({ viewport: { width: captureSize, height: captureSize }, deviceScaleFactor: 1 });
    try {
      const page = await context.newPage(), errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(new URL(object.route, origin).href, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(id => {
        const diagnostic: unknown = Reflect.get(window, `__${id}`);
        const app: unknown = Reflect.get(window, '__cssEarth');
        return diagnostic && typeof diagnostic === 'object' && Reflect.get(diagnostic, 'ready') === true &&
          app && typeof app === 'object' && Reflect.get(app, 'ready') === true && document.readyState === 'complete';
      }, object.id, { timeout: 30000 });
      // Preparation-only isolation: use the actual CSS scene and delivered images.
      await page.addStyleTag({ content: `
        html,body,.object-stage { background:transparent!important; }
        body > :not(.object-viewport) { display:none!important; }
        .object-viewport { inset:0!important; }
        .object-viewport-search-band,.object-world-stage > :not(.object-stage),
        .object-input-surface,.object-scene-overlays,.prepared-surface-features { display:none!important; }
        .object-stage > .object-render-root { translate:none!important; transform-origin:50% 50%!important; }
      ` });
      await page.evaluate(() => new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
      let image: Buffer | undefined;
      for (let attempt = 0; attempt < 6; attempt++) {
      const world = worldCameraFromCenteredPresentation({ rotation, distanceUnits: distanceM / object.worldFrame.metersPerUnit },
        object.worldFrame, { focalPixels: 1, principalOffsetPixels: [0, 0] });
      const state = await page.evaluate(async ({ id, world, frame }) => {
        const diagnostic: unknown = Reflect.get(window, `__${id}`);
        if (!diagnostic || typeof diagnostic !== 'object') throw new Error('Missing body diagnostics.');
        const camera = Reflect.get(diagnostic, 'camera'), set: unknown = Reflect.get(camera, 'applyWorldCamera');
        if (typeof set !== 'function') throw new Error('Missing prepared camera control.');
        await Reflect.apply(set, camera, [world, frame]);
        return Reflect.apply(Reflect.get(diagnostic, 'view'), diagnostic, []);
      }, { id: object.id, world, frame: object.worldFrame });
      const focal = requireFiniteNumber(requireRecord(state).focal);
      // Input state changes before the acknowledged frame. In particular, the
      // globe and its separate emission plates must publish the same camera.
      const positionPrecisionM = Number.EPSILON * Math.max(...object.worldFrame.originM.map(Math.abs)) * 4;
      await page.waitForFunction(({ id, distanceM, metersPerUnit, toleranceM }) => {
        const diagnostic = Reflect.get(window, `__${id}`), owner = Reflect.get(diagnostic, 'runtime');
        const view: unknown = Reflect.apply(Reflect.get(owner, 'view'), owner, []);
        if (!view || typeof view !== 'object') return false;
        const distance: unknown = Reflect.get(view, 'distance');
        return typeof distance === 'number' && Math.abs(distance * metersPerUnit - distanceM) <= toleranceM;
      }, { id: object.id, distanceM, metersPerUnit: object.worldFrame.metersPerUnit,
        toleranceM: Math.max(distanceM * 1e-5, positionPrecisionM) });
      await page.waitForFunction(id => {
        const d = Reflect.get(window, `__${id}`), owner = Reflect.get(d, 'runtime');
        const r = Reflect.apply(Reflect.get(owner, 'resources'), owner, []);
        if (!r || typeof r !== 'object') return false;
        const pending: unknown = Reflect.get(r, 'pending'), images: unknown = Reflect.get(r, 'images');
        if (!Array.isArray(pending) || !images || typeof images !== 'object') return false;
        const entries: unknown = Reflect.get(images, 'entries');
        return pending.length === 0 && Array.isArray(entries) && entries.every((entry: unknown) =>
          entry && typeof entry === 'object' && Reflect.get(entry, 'ready') === true);
      }, object.id);
      {
        // Prepared leaves join across frames in paced reveal and texture-activation
        // batches. HD 29615 once shipped a billboard missing one late leaf; wait
        // until the hidden-leaf count holds for ten frames before capturing.
        await page.evaluate(() => new Promise<void>(done => {
          let last = -1, steady = 0;
          const tick = () => {
            const hidden = document.querySelectorAll('.object-stage s[style*="display: none"]').length;
            steady = hidden === last ? steady + 1 : 0; last = hidden;
            if (steady >= 10) done(); else requestAnimationFrame(tick);
          };
          tick();
        }));
        const settled = requireRecord(await page.evaluate(id => {
          const diagnostic = Reflect.get(window, `__${id}`);
          return Reflect.apply(Reflect.get(diagnostic, 'view'), diagnostic, []);
        }, object.id));
        const actualDistanceM = requireFiniteNumber(settled.distanceKilometers) * 1000;
        if (Math.abs(actualDistanceM - distanceM) > Math.max(distanceM * 1e-5, positionPrecisionM))
          throw new Error(`The camera moved away from the requested prepared pose: expected ${distanceM / 1000} km, observed ${settled.distanceKilometers} km.`);
        // A capture must match a second one a few frames later: coverage still
        // changing means some leaf had not joined yet.
        // Pulsating stars loop their surface motion and light curves; hold each loop
        // at time 0, where the runtime starts it on arrival, so frames can agree.
        await page.evaluate(() => {
          for (const animation of document.getAnimations())
            if (animation.effect?.getTiming().iterations === Infinity) { animation.pause(); animation.currentTime = 0; }
        });
        const coverage = async (png: Buffer) => sharp(png).ensureAlpha().extractChannel(3).raw().toBuffer();
        let shot = await page.screenshot({ omitBackground: true }), stable = false;
        for (let check = 0; check < 5 && !stable; check++) {
          await page.evaluate(() => new Promise<void>(done => { let frames = 5; const tick = () => --frames ? requestAnimationFrame(tick) : done(); requestAnimationFrame(tick); }));
          const again = await page.screenshot({ omitBackground: true });
          stable = (await coverage(shot)).equals(await coverage(again));
          shot = again;
        }
        if (!stable) throw new Error(`${object.id}: silhouette coverage kept changing across five capture checks.`);
        const raw = await sharp(shot).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        let extent = 0, opaque = 0;
        for (let y = 0; y < captureSize; y++) for (let x = 0; x < captureSize; x++) {
          if (raw.data[(y * captureSize + x) * 4 + 3]! < 8) continue;
          opaque++; extent = Math.max(extent, Math.abs(x - captureSize / 2), Math.abs(y - captureSize / 2));
        }
        if (!opaque) throw new Error('The prepared body is blank.');
        if (extent >= captureSize / 2 - 4) {
          await writeFile(resolve(output, `${object.id}-clipped.png`), shot);
          // Some rings and emission plates extend beyond the reference body
          // radius. Move the preparation camera back until the entire scene fits.
          distanceM *= 2;
          continue;
        }
        // Keep the physical body centre fixed even for asymmetric silhouettes.
        const half = Math.min(captureSize / 2, Math.ceil(extent + 8)), side = half * 2, resize = size / side;
        image = await sharp(shot).extract({ left: captureSize / 2 - half, top: captureSize / 2 - half, width: side, height: side })
          .resize(size, size).png().toBuffer();
        const billboard = parseArrivalBillboard({ url: `/scenes/${object.id}/${filename}`, size, distanceM,
          focalPixels: focal * resize, lens, rotation });
        if (errors.length) throw new Error(errors.join('\n'));
        const bytes = await writeLossyWebp(sharp(image), resolve(root, 'public/scenes', object.id, filename));
        const metadata = Buffer.from(JSON.stringify(billboard, null, 2) + '\n');
        await writeFile(resolve(prepared, 'arrival-billboard.json'), metadata);
        const inventory = await readInventory(object.id, objectDirectory);
        if (!inventory) throw new Error(`No runtime inventory for ${object.id}.`);
        for (const [location, name, data] of [['public', filename, bytes], ['prepared', 'arrival-billboard.json', metadata]] as const) {
          const assets = inventory.assets.filter(asset => asset.location === location && asset.filename !== name);
          assets.push({ location, filename: name, bytes: data.length, sha256: sha256(data) });
          await updateInventory({ objectId: object.id, objectDirectory, location, assets });
        }
        const report = { id: object.id, identity, billboard, bytes: bytes.length, renderer: browser.version(), errors };
        await writeFile(receiptPath, JSON.stringify(report, null, 2) + '\n');
        reports.push(report); console.log(`[${index + 1}/${objects.length}] ${object.id}: ${bytes.length} bytes`);
        break;
      }
      }
      if (!image) throw new Error('The body clips the square at every preparation scale.');
    } catch (error) { failures.push(object.id); console.error(`${object.id}: ${error instanceof Error ? error.message : error}`); }
    finally { await context.close(); }
  }
} finally { await browser.close(); }
await writeFile(resolve(output, 'report.json'), JSON.stringify({ reports, failures }, null, 2) + '\n');
if (failures.length) throw new Error(`Arrival preparation failed: ${failures.join(', ')}`);
console.log(`Prepared ${reports.length} arrival billboards. Publish the changed inventories before merging.`);
