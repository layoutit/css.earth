/** Real main-site nebulae: retained search/navigation, datasets, compact lights and depth. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import type { Locator } from 'playwright';
import { cameraPoseToReferenceFrame, presentPhysicalPoseInVolume } from '@cssearth/engine';
import { validatePreparedVolumeLenses } from '../../src/renderers/css/dist/universe.js';
import { parsePreparedWorldContext } from '../../src/renderers/css/dist/index.js';
import { validateObjectProvenance } from '../../src/platform/object-provenance.mts';
import { parseSharedView } from '../../src/renderers/css/dist/navigation.js';
import { parsePreparedVolumePresentation } from '../volume-presentation.mts';
import { createTestPage } from './browser-observations.mts';
import { requireRecord } from '../../tools/source-values.mts';

declare global { interface Window { __nebulaProductionNodes: Element[]; } }

// Keep the original no-argument cases. A focused delivery run supplies comma-separated ids and an output directory.
const base = process.argv[2] ?? 'http://127.0.0.1:4210';
const ids = (process.argv[3] ?? 'm42,helix,m2-9').split(',');
assert.ok(ids.length && ids.every(id => /^[a-z][a-z0-9-]*$/u.test(id)) && new Set(ids).size === ids.length,
  'Expected distinct comma-separated prepared object ids.');
const directory = resolve(process.argv[4] ?? 'output/nebula-production-browser');
const lensSelection = process.argv[5] ?? 'all';
assert.ok(lensSelection === 'all' || lensSelection === 'default', 'Lens selection is all or default.');
const aliases: Readonly<Record<string, readonly string[]>> = {
  m42: ['Orion', 'NGC 1976'], helix: ['Helix', 'NGC 7293'], 'm2-9': ['M2-9', 'M2–9'],
  m45: ['Pleiades', 'M45'], m1: ['Crab', 'M1'], m8: ['Lagoon', 'M8'],
};
await mkdir(directory, { recursive: true });
const context = parsePreparedWorldContext(JSON.parse(await readFile('src/objects/sun/prepared/world-context.json', 'utf8')));
const inputPins: { path: string; bytes: number; sha256: string }[] = [];
async function readPrepared(id: string, file: string): Promise<unknown> {
  const path = `src/objects/${id}/prepared/${file}.json`, bytes = await readFile(path);
  inputPins.push({ path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  return JSON.parse(bytes.toString('utf8'));
}
const subjects = await Promise.all(ids.map(async id => {
  const payload = validatePreparedVolumeLenses(requireRecord(await readPrepared(id, 'lenses')).data);
  const provenance = validateObjectProvenance(await readPrepared(id, 'provenance'), id);
  return { id, payload, provenance,
    presentation: parsePreparedVolumePresentation(await readPrepared(id, 'presentation'), payload, provenance) };
}));
const browser = await chromium.launch({ headless: true });
const viewport = { width: 1440, height: 1000 }, deviceScaleFactor = 1;
const page = await createTestPage(browser, { viewport, deviceScaleFactor, reducedMotion: 'reduce' });
page.setDefaultTimeout(30_000);
const errors: string[] = [], failed: string[] = [], requests: string[] = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) {
  const failure = `${response.status()} ${response.url()}`; failed.push(failure); console.error(`NEBULA_WORLD_HTTP ${failure}`);
} });
page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) requests.push(request.url()); });
const report: { objects: unknown[]; captures: unknown[]; errors: string[]; failed: string[]; navigationRequests: string[];
  result?: string; failure?: string; base: string; browser: string; viewport: typeof viewport; deviceScaleFactor: number;
  revision: string; dirtyFiles: string[]; inputPins: typeof inputPins } = {
  base, browser: browser.version(), viewport, deviceScaleFactor,
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirtyFiles: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean),
  inputPins, objects: [], captures: [], errors, failed, navigationRequests: requests,
};
const settle = () => page.evaluate(() => new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
async function capture(name: string) {
  await settle();
  const camera = await page.evaluate(() => {
    const state = window.__cssearthTest.object('sun').camera.state();
    return { ...state, pose: state.pose };
  });
  // The shared URL owner publishes after a quiet period. Require its decoded pose to match this capture.
  let url = page.url(), matched = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    url = page.url();
    const token = new URL(url).searchParams.get('v');
    const saved = token ? parseSharedView(`v=${token}`) : null;
    const values = (scene: string) => scene.slice(9, -1).split(',').map(Number);
    const expected = values(camera.pose.scene);
    const actual = saved ? values(saved.camera.pose.scene) : [];
    const close = (left: number, right: number) => Math.abs(left - right) <= Math.max(1e-9, Math.abs(right) * 1e-10);
    matched = !!saved && typeof saved.camera.distanceKilometers === 'number' && typeof camera.distanceKilometers === 'number'
      && close(saved.camera.distanceKilometers, camera.distanceKilometers) && actual.length === 16 && expected.length === 16
      && actual.every((value, index) => close(value, expected[index]!));
    if (matched) break;
    await page.waitForTimeout(50);
  }
  if (!matched) await writeFile(resolve(directory, 'camera-url-mismatch.json'), JSON.stringify({ url, camera,
    saved: parseSharedView(`v=${new URL(url).searchParams.get('v')}`) }, null, 2) + '\n');
  assert.ok(matched, 'A capture URL must encode its actual camera.');
  const path = resolve(directory, `${name}.png`);
  await page.screenshot({ path });
  report.captures.push({ path, url, camera });
  await writeFile(resolve(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`NEBULA_WORLD_CAPTURE ${name} ${url}`);
}
async function decodeCssImages(root: Locator) {
  const urls = await root.locator('s').evaluateAll(nodes => [...new Set(nodes.flatMap(node => {
    const image = getComputedStyle(node).backgroundImage;
    return image.startsWith('url("') && image.endsWith('")') ? [image.slice(5, -2)] : [];
  }))]);
  assert.ok(urls.length > 0, 'A prepared nebula has actual texture URLs.');
  await page.evaluate(async urls => {
    await Promise.all(urls.map(url => new Promise<void>((done, reject) => {
      const image = new Image(); image.onload = () => done(); image.onerror = () => reject(new Error(`Missing nebula texture: ${url}`)); image.src = url;
    })));
  }, urls);
  return urls.length;
}
async function waitFocus(id: string) {
  await page.waitForFunction(id => new URL(location.href).searchParams.get('focus') === id, id);
  await page.locator(`[data-focus-lens-bank="${id}"]`).waitFor({ state: 'visible' });
  const subject = subjects.find(subject => subject.id === id); assert.ok(subject);
  const frame = subject.payload.lenses[0]!.volume.frame;
  await page.waitForFunction(({ frame, center, radius }) => {
    const position = window.__cssearthTest.object('sun').camera.captureWorldCamera(frame).pose.positionM;
    return Math.hypot(...position.map((value, axis) => value - center[axis]!)) < radius * 20;
  }, { frame: context.frame, center: frame.originM, radius: subject.payload.framingRadiusUnits * frame.metersPerUnit });
  await settle();
}
async function checkCloudLabel(id: string, frame: Parameters<typeof presentPhysicalPoseInVolume>[1]) {
  await page.waitForFunction(id => {
    const node = document.querySelector<HTMLElement>(`[data-galaxy-label="${id}"]`);
    return node?.style.pointerEvents === 'auto' && Number(getComputedStyle(node).opacity) > .1;
  }, id, { timeout: 5000 });
  const observed = await page.evaluate(({ id, reference }) => {
    const test = window.__cssearthTest, camera = test.physicalCamera('sun');
    const label = test.element(`[data-galaxy-label="${id}"]`).getBoundingClientRect();
    const root = test.element('.prepared-galaxy-catalog').getBoundingClientRect();
    return { world: test.object('sun').camera.captureWorldCamera(reference), focal: camera.focal,
      offset: camera.principalOffset, root: { x: root.x, y: root.y, width: root.width, height: root.height },
      label: { left: label.left, right: label.right, bottom: label.bottom } };
  }, { id, reference: context.frame });
  const local = presentPhysicalPoseInVolume(observed.world.pose, frame);
  // Independently project the prepared cloud box using the inverse camera quaternion.
  // Do not reuse the label owner's bounds/projector, or allow field-star extents to move the label.
  const q = local.orientationXyzw, qx = -q[0], qy = -q[1], qz = -q[2], qw = q[3];
  const corners = Array.from({ length: 8 }, (_, index) => {
    const v = [0, 1, 2].map(axis => (index & (1 << axis) ? frame.boundsUnits.max[axis]! : frame.boundsUnits.min[axis]!) - local.positionUnits[axis]!);
    const [vx, vy, vz] = v, tx = 2 * (qy * vz! - qz * vy!), ty = 2 * (qz * vx! - qx * vz!), tz = 2 * (qx * vy! - qy * vx!);
    const x = vx! + qw * tx + qy * tz - qz * ty, y = vy! + qw * ty + qz * tx - qx * tz;
    const depth = -(vz! + qw * tz + qx * ty - qy * tx);
    assert.ok(depth > 0, 'The inspected whole cloud must be in front of the observer.');
    return { x: observed.root.x + observed.root.width / 2 + observed.offset[0]! + observed.focal * x / depth,
      y: observed.root.y + observed.root.height / 2 + observed.offset[1]! + observed.focal * y / depth };
  });
  const cloud = { left: Math.min(...corners.map(point => point.x)), right: Math.max(...corners.map(point => point.x)), top: Math.min(...corners.map(point => point.y)) };
  const gapPixels = cloud.top - observed.label.bottom;
  assert.ok(gapPixels >= 7 && gapPixels <= 9, `${id}: label must sit above its projected cloud (gap ${gapPixels}px).`);
  assert.ok(Math.abs((observed.label.left + observed.label.right - cloud.left - cloud.right) / 2) < 1, 'The label must follow the cloud center while orbiting.');
  return { gapPixels, cloud, label: observed.label };
}
try {
  const response = await page.goto(`${base}/sun/?focus=${ids[0]}`, { waitUntil: 'domcontentloaded' });
  assert.equal(response?.status(), 200);
  await page.waitForFunction(ids => window.__sun?.ready && ids.every(id => document.querySelector(`[data-volume-lens-object="${id}"]`)), ids, { timeout: 120_000 });
  console.log('NEBULA_WORLD_READY');
  await waitFocus(ids[0]!);
  const motion = page.locator('input[name="motion"]');
  if (await motion.count() && await motion.isChecked()) await motion.uncheck({ force: true });
  await page.evaluate(() => {
    window.__nebulaProductionNodes = [...document.querySelectorAll('.planet-stage, [data-volume-lens-object], [data-volume-lens-object] .css-volume-mesh > s, [data-volume-lens-object] [data-catalogue-source], [data-volume-impostor]')];
  });
  await decodeCssImages(page.locator(`[data-volume-lens-object="${ids[0]}"] [data-volume-lens="${subjects[0]!.payload.defaultLens}"]`));
  await capture(`${ids[0]}-direct-focus`);
  for (const { id, payload, provenance, presentation } of subjects) {
    console.log(`NEBULA_WORLD_CASE ${id}`);
    const queries = aliases[id] ?? [id], search = page.locator('.planet-sidebar-search');
    // An exact name for the already selected object intentionally shows its card.
    // Exercise actual search navigation from a different available prepared focus.
    if (new URL(page.url()).searchParams.get('focus') === id) {
      const other = await page.locator('[data-focus-lens-bank]').evaluateAll((nodes, id) =>
        nodes.map(node => node.getAttribute('data-focus-lens-bank')).find(candidate => candidate && candidate !== id), id);
      assert.ok(other, 'Search navigation needs a different prepared destination.');
      await search.fill(other);
      await page.locator(`.planet-object-link[data-prepared-focus-id="${other}"]`).click();
      await page.waitForFunction(id => new URL(location.href).searchParams.get('focus') === id, other);
      await page.locator(`[data-focus-lens-bank="${other}"]`).waitFor({ state: 'visible' });
    }
    for (const query of queries) {
      await search.fill(query);
      const result = page.locator(`.planet-object-link[data-prepared-focus-id="${id}"]`);
      await result.waitFor({ state: 'visible' });
      await result.click();
      await waitFocus(id);
      assert.equal(new URL(page.url()).pathname, '/sun/', 'Search must keep the shared scene owner.');
    }
    await search.fill('');
    const frame = payload.lenses[0]!.volume.frame, radius = payload.framingRadiusUnits;
    const focal = await page.evaluate(() => window.__cssearthTest.physicalCamera('sun').focal);
    const extent = [0, 1, 2].map(axis => Math.max(Math.abs(frame.boundsUnits.min[axis]!), Math.abs(frame.boundsUnits.max[axis]!)));
    const framingDistance = (angle: number) => {
      const horizontal = extent[0]! * Math.cos(angle) + extent[2]! * Math.sin(angle);
      const depth = extent[0]! * Math.sin(angle) + extent[2]! * Math.cos(angle);
      return Math.max(radius * 4, depth + focal * Math.max(horizontal / 330, extent[1]! / 400));
    };
    const frontDistance = framingDistance(0), obliqueDistance = framingDistance(.6);
    const apply = async (distance: number, angle = 0) => {
      // Orbit, rather than roll, about the model's local Y axis, keeping its origin centered.
      const pose = cameraPoseToReferenceFrame({
        positionM: [-Math.sin(angle) * distance * frame.metersPerUnit, 0, -Math.cos(angle) * distance * frame.metersPerUnit],
        orientationXyzw: [Math.cos(angle / 2), 0, -Math.sin(angle / 2), 0],
      }, frame);
      await page.evaluate(({ world, frame }) => window.__cssearthTest.object('sun').camera.applyWorldCamera(world, frame),
        { world: { referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt, pose }, frame: context.frame });
      await settle();
    };
    await apply(radius * 8);
    const beforeFlight = await page.evaluate(frame => window.__cssearthTest.object('sun').camera.captureWorldCamera(frame).pose.positionM, context.frame);
    const label = page.locator(`[data-galaxy-label="${id}"]`);
    await page.waitForFunction(id => {
      const element = document.querySelector<HTMLElement>(`[data-galaxy-label="${id}"]`);
      return element && element.style.pointerEvents === 'auto' && Number(getComputedStyle(element).opacity) > .1;
    }, id, { timeout: 15_000 });
    const bounds = await label.boundingBox(); assert.ok(bounds, 'A visible label needs screen bounds.');
    await page.mouse.dblclick(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, { delay: 65 });
    await waitFocus(id);
    await page.waitForFunction(({ previous, frame }) => {
      const current = window.__cssearthTest.object('sun').camera.captureWorldCamera(frame).pose.positionM;
      return current.some((value, axis) => Math.abs(value - previous[axis]!) > 1);
    }, { previous: beforeFlight, frame: context.frame });
    const bank = page.locator(`[data-volume-lens-object="${id}"]`);
    assert.equal(await bank.evaluate(element => getComputedStyle(element).display), 'block');
    const count = await bank.locator('[data-catalogue-source]').count();
    assert.equal(count, payload.lenses[0]!.stars.points.length);
    const controls = page.locator(`[data-focus-lens-bank="${id}"]`);
    const card = page.locator('[data-prepared-focus-card]');
    assert.equal(await controls.locator('[data-focus-lens]').count(), payload.lenses.length);
    const lensResults: unknown[] = [];
    const sideCaptures: unknown[] = [];
    const objectReport = { id, queries, lenses: lensResults, stars: count, labelFlyTo: true, cameraRetainedAcrossLenses: true, sides: sideCaptures };
    report.objects.push(objectReport);
    for (const lens of payload.lenses) {
      if (lensSelection === 'default' && lens.id !== payload.defaultLens) continue;
      console.log(`NEBULA_WORLD_LENS ${id}/${lens.id}`);
      await apply(frontDistance);
      const before = await page.evaluate(() => JSON.stringify(window.__cssearthTest.object('sun').camera.state()));
      const button = controls.locator(`[data-focus-lens][value="${lens.id}"]`);
      const presentationLens = presentation.controls.find(control => control.id === lens.id); assert.ok(presentationLens);
      assert.equal((await button.innerText()).trim(), presentationLens.label, 'Dataset rows contain only their image names.');
      assert.doesNotMatch(await button.innerText(), /\d+\s*[×x]\s*\d+\s*px/u, 'Pixel dimensions belong in Factsheet.');
      await button.click();
      await page.waitForFunction(({ id, lens }) => document.querySelector(`[data-volume-lens-object="${id}"]`)?.getAttribute('data-selected-lens') === lens, { id, lens: lens.id });
      assert.equal(await page.evaluate(() => JSON.stringify(window.__cssearthTest.object('sun').camera.state())), before, 'A lens switch moved the world camera.');
      assert.equal(new URL(page.url()).searchParams.get('focusLens'), lens.id);
      const cloud = bank.locator(`[data-volume-lens="${lens.id}"]`);
      const textures = await decodeCssImages(cloud);
      const details = controls.locator(`[data-focus-lens-details="${lens.id}"]`);
      await details.waitFor({ state: 'visible' });
      assert.equal(await details.locator('.planet-facts, .planet-lens-facts').count(), 0, 'Dataset facts moved to Factsheet.');
      await details.locator('.planet-lens-texture').evaluate(element => {
        if (!(element instanceof HTMLImageElement)) throw new TypeError('The dataset preview must be an image.');
        return element.decode();
      });
      const sourceContext = page.locator(`.planet-dataset-context-rail [data-dataset-context-owner="${id}"]:not([hidden]) [data-dataset-context="${lens.id}"]:not([hidden])`);
      await sourceContext.waitFor({ state: 'visible' });
      const sourceIds = [...new Set(provenance.sources.filter(source => source.lensId === lens.id).flatMap(source => source.sourceBinding?.kind === 'catalogued'
        ? source.sourceBinding.references.filter(reference => reference.role === 'material').map(reference => reference.catalogueId) : []))];
      assert.ok(sourceIds.length > 0, `${id}/${lens.id}: identify the original image source.`);
      for (const sourceId of sourceIds) assert.equal(await sourceContext.locator(`[data-source="${sourceId}"]`).first().isVisible(), true);
      assert.ok(await sourceContext.locator('[data-facility], [data-mission], [data-unresolved]').count() > 0, 'Capture attribution must be explicit.');
      await card.getByRole('tab', { name: 'Factsheet', exact: true }).click();
      const factsBank = card.locator(`[data-focus-facts-bank="${id}"]`);
      await factsBank.waitFor({ state: 'visible' });
      const activeFacts = factsBank.locator('[data-focus-lens-details]:not([hidden])');
      assert.equal(await activeFacts.count(), 1);
      assert.equal(await activeFacts.getAttribute('data-focus-lens-details'), lens.id);
      const pixelFact = presentationLens.facts?.find(fact => fact.id === 'source-pixels');
      assert.ok(pixelFact, 'Each image has its native source dimensions in Factsheet.');
      const pixelRow = activeFacts.locator('li').filter({ has: page.locator('.planet-fact-label', { hasText: pixelFact.label }) });
      assert.equal((await pixelRow.locator('.planet-fact-value').innerText()).trim(), pixelFact.value);
      await card.getByRole('tab', { name: 'Datasets', exact: true }).click();
      await sourceContext.waitFor({ state: 'visible' });
      assert.equal(await page.evaluate(() => JSON.stringify(window.__cssearthTest.object('sun').camera.state())), before, 'Factsheet switching moved the camera.');
      await capture(`${id}-${lens.id}`);
      const frontLabel = await checkCloudLabel(id, frame);
      let lod: unknown;
      if (lens.volume.impostors) {
        const impostors = lens.volume.impostors;
        await apply(2 * focal * impostors.radiusUnits / (impostors.fullBelowDiameterPixels * .8));
        assert.equal(await cloud.getAttribute('data-volume-detail-mix'), '0', 'Distant framing must select prepared impostors.');
        assert.equal(await cloud.locator('.css-volume-detail').evaluate(element => getComputedStyle(element).display), 'none');
        assert.equal(await cloud.locator('.css-volume-impostors').evaluate(element => getComputedStyle(element).display), 'block');
        assert.ok(await cloud.locator('[data-volume-impostor]').evaluateAll(nodes => nodes.some(node => getComputedStyle(node).display === 'block')));
        const distantDiameter = Number(await cloud.getAttribute('data-volume-diameter-pixels'));
        await capture(`${id}-${lens.id}-distant`);
        await apply(Math.min(frontDistance, 2 * focal * impostors.radiusUnits / (impostors.volumeAboveDiameterPixels * 1.2)));
        assert.equal(await cloud.getAttribute('data-volume-detail-mix'), '1', 'Near framing must select the full prepared volume.');
        assert.equal(await cloud.locator('.css-volume-detail').evaluate(element => getComputedStyle(element).display), 'block');
        assert.equal(await cloud.locator('.css-volume-impostors').evaluate(element => getComputedStyle(element).display), 'none');
        lod = { distantDiameter, nearDiameter: Number(await cloud.getAttribute('data-volume-diameter-pixels')), distantImpostor: true, nearVolume: true };
      }
      await apply(obliqueDistance, .6);
      await capture(`${id}-${lens.id}-oblique`);
      const obliqueLabel = await checkCloudLabel(id, frame);
      lensResults.push({ id: lens.id, textures, sourceIds, sourcePixels: pixelFact.value, frontLabel, obliqueLabel, cameraRetained: true, lod });
      assert.equal(await page.evaluate(() => window.__nebulaProductionNodes.every(element => element.isConnected)), true, 'Navigation or lens/LOD selection replaced prepared nodes.');
    }
    // Inspect the accepted shape at both exact 90-degree side axes, not only from Earth and obliquely.
    const defaultButton = controls.locator(`[data-focus-lens][value="${payload.defaultLens}"]`);
    if (await defaultButton.count()) {
      await defaultButton.click();
      await page.waitForFunction(({ id, lens }) => document.querySelector(`[data-volume-lens-object="${id}"]`)?.getAttribute('data-selected-lens') === lens,
        { id, lens: payload.defaultLens });
    }
    for (const [name, angle] of [['side-plus', Math.PI / 2], ['side-minus', -Math.PI / 2]] as const) {
      await apply(framingDistance(angle), angle);
      const sideTextures = await decodeCssImages(bank.locator(`[data-volume-lens="${payload.defaultLens}"]`));
      await capture(`${id}-${name}`);
      sideCaptures.push({ name, angleRadians: angle, lens: payload.defaultLens, textures: sideTextures });
    }
    await apply(frontDistance);
    assert.equal(await controls.locator('[data-focus-stars]').count(), 0, 'The selected-object card does not duplicate the shell-level 3D-stars setting.');
    const stars = page.locator('.planet-three-d-stars-setting');
    if (count && !await stars.isChecked()) await page.locator('label:has(.planet-three-d-stars-setting)').click();
    const pointRoot = bank.locator('.prepared-catalogue-points');
    assert.equal(await pointRoot.evaluate(element => getComputedStyle(element).display), 'block');
    const checkStars = async (distance: number) => {
      await apply(distance);
      const measured = await bank.locator('[data-catalogue-source]').evaluateAll(nodes => nodes.map(node => {
        const style = getComputedStyle(node), bounds = node.getBoundingClientRect();
        return { id: node.getAttribute('data-catalogue-source'), visible: style.visibility === 'visible',
          width: parseFloat(style.width), x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
      }));
      const observation = await page.evaluate(({ id, reference }) => {
        const test = window.__cssearthTest, camera = test.physicalCamera('sun');
        const bounds = test.element(`[data-volume-lens-object="${id}"] .prepared-catalogue-points`).getBoundingClientRect();
        return { world: test.object('sun').camera.captureWorldCamera(reference), focal: camera.focal,
          offset: camera.principalOffset, x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
      }, { id, reference: context.frame });
      const local = presentPhysicalPoseInVolume(observation.world.pose, frame);
      const selected = payload.lenses.find(lens => lens.id === new URL(page.url()).searchParams.get('focusLens')); assert.ok(selected);
      const points = new Map(selected.stars.points.map(point => [point.id, point]));
      const visible = measured.filter(point => point.visible);
      if (count) assert.ok(visible.length > 0, 'The prepared stellar field must be visible.');
      const samples = visible.map(node => {
        const point = points.get(node.id!); assert.ok(point);
        // The front camera looks from local -Z: +X is screen-right and +Y is screen-up.
        const depth = point.positionUnits[2] - local.positionUnits[2];
        assert.ok(depth > 0);
        const expectedWidth = point.diameterUnits === undefined ? point.sizePx : point.diameterUnits * observation.focal / depth;
        const expectedX = observation.x + observation.offset[0]! + observation.focal * (point.positionUnits[0] - local.positionUnits[0]) / depth;
        const expectedY = observation.y + observation.offset[1]! - observation.focal * (point.positionUnits[1] - local.positionUnits[1]) / depth;
        assert.ok(Math.abs(node.width - expectedWidth) <= Math.max(.02, expectedWidth * .002), `${id}/${node.id}: stellar angular diameter must follow its actual depth.`);
        assert.ok(Math.hypot(node.x - expectedX, node.y - expectedY) < .15, `${id}/${node.id}: stellar position must project from its physical 3D coordinates.`);
        return { id: node.id, depthUnits: depth, width: node.width, expectedWidth };
      });
      return { distance, visible: samples.length, samples };
    };
    const frontStars = await checkStars(frontDistance), closerStars = await checkStars(frontDistance / 2);
    if (count) {
      await starToggle.click();
      assert.equal(await stars.isChecked(), false);
      assert.equal(await pointRoot.evaluate(element => getComputedStyle(element).display), 'none');
      await starToggle.click();
      assert.equal(await stars.isChecked(), true);
      assert.equal(await pointRoot.evaluate(element => getComputedStyle(element).display), 'block');
    }
    await apply(obliqueDistance, .6);
    await capture(`${id}-oblique`);
    Object.assign(objectReport, { visibleStars: frontStars.visible, physicalStarProjection: { front: frontStars, closer: closerStars }, starsToggle: count ? true : undefined });
  }
  assert.equal(requests.length, 1, 'Nebula navigation reloaded the page.');
  assert.equal(await page.evaluate(() => window.__nebulaProductionNodes.every(element => element.isConnected)), true);
  assert.deepEqual(errors, []); assert.deepEqual(failed, []); report.result = 'PASS';
  console.log(`NEBULA_WORLD_PASS ${JSON.stringify(report.objects)}`);
} catch (error) {
  report.result = 'FAIL'; report.failure = error instanceof Error ? error.stack ?? error.message : String(error);
  await capture('failure').catch(() => {});
  throw error;
} finally {
  await writeFile(resolve(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
