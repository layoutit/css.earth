/**
 * App acceptance inspection for a promoted volume lens bank.
 *
 * Opens the native `/sun/?focus=<id>` route, so the server fragment must retain the object's complete
 * physical-host chain before the lens bank mounts, then captures the Earth view, an oblique
 * view, both exact 90-degree side axes, every lens switch and stars on and off when present, and writes them with a
 * machine-readable record. Object packages call it through their own inspection entry.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { chromium } from 'playwright';
import type { Locator } from 'playwright';
import { cameraPoseToReferenceFrame } from '@cssearth/engine';
import { validatePreparedVolumeLenses } from '../../../../src/renderers/css/dist/universe.js';
import { parsePreparedWorldContext } from '../../../../src/renderers/css/dist/index.js';
import { validateObjectProvenance } from '../../../../src/platform/object-provenance.mts';
import { parsePreparedVolumePresentation } from '../../../../site/volume-presentation.mts';
import { createTestPage } from '../../../../site/test/browser-observations.mts';
import { requireRecord } from '../../../../tools/source-values.mts';

export async function inspectVolumeLensBank(OBJECT_ID: string, base: string, directory: string) {
  const LOG = OBJECT_ID.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  await mkdir(directory, { recursive: true });

  const inputPins: { path: string; bytes: number; sha256: string }[] = [];
  async function readPrepared(file: string): Promise<unknown> {
    const path = `src/objects/${OBJECT_ID}/prepared/${file}.json`, bytes = await readFile(path);
    inputPins.push({ path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    return JSON.parse(bytes.toString('utf8'));
  }
  const contextPath = 'src/objects/sun/prepared/world-context.json', contextBytes = await readFile(contextPath);
  inputPins.push({ path: contextPath, bytes: contextBytes.length, sha256: createHash('sha256').update(contextBytes).digest('hex') });
  const context = parsePreparedWorldContext(JSON.parse(contextBytes.toString('utf8')));
  const payload = validatePreparedVolumeLenses(requireRecord(await readPrepared('lenses')).data);
  const provenance = validateObjectProvenance(await readPrepared('provenance'), OBJECT_ID);
  const presentation = parsePreparedVolumePresentation(await readPrepared('presentation'), payload, provenance);
  const frame = payload.lenses[0]!.volume.frame;

  const viewport = { width: 1440, height: 1000 }, deviceScaleFactor = 1;
  const browser = await chromium.launch({ headless: true });
  const page = await createTestPage(browser, { viewport, deviceScaleFactor, reducedMotion: 'reduce' });
  page.setDefaultTimeout(60_000);
  const errors: string[] = [], failed: string[] = [];
  page.on('pageerror', error => errors.push(error.message.split('\n')[0]!));
  page.on('response', response => { if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`); });

  interface Capture { name: string; path: string; bytes: number; sha256: string; camera: string; url: string; view: string; lens: string; textures?: number }
  const report: {
    objectId: string; base: string; browser: string; viewport: typeof viewport; deviceScaleFactor: number;
    revision: string; dirtyFiles: string[]; inputPins: typeof inputPins; navigation: string;
    lenses: { id: string; label: string; textures: number; cameraRetained: boolean; sourceIds: string[] }[];
    stars: { total: number; visibleWithStarsOn: number; rootDisplayOn: string; rootDisplayOff: string };
    captures: Capture[]; errors: string[]; failed: string[]; result?: string; failure?: string;
  } = {
    objectId: OBJECT_ID, base, browser: browser.version(), viewport, deviceScaleFactor,
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirtyFiles: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean),
    inputPins, navigation: 'direct native /sun/?focus=<id> route', lenses: [],
    stars: { total: 0, visibleWithStarsOn: 0, rootDisplayOn: '', rootDisplayOff: '' },
    captures: [], errors, failed,
  };
  const write = async () => writeFile(resolve(directory, 'inspection.json'), JSON.stringify(report, null, 2) + '\n');
  const settle = () => page.evaluate(() => new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done()))));

  async function capture(name: string, view: string, lens: string, textures?: number) {
    await settle();
    const path = resolve(directory, `${name}.png`);
    await page.screenshot({ path });
    const bytes = await readFile(path);
    report.captures.push({ name, path: relative(process.cwd(), path), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
      camera: await cameraState(), url: page.url(), view, lens, ...(textures === undefined ? {} : { textures }) });
    await write();
    console.log(`${LOG}_INSPECTION_CAPTURE ${name} ${view}`);
  }
  /** Every painted slab must resolve to a texture the browser can decode. */
  async function decodeCssImages(root: Locator) {
    const urls = await root.locator('s').evaluateAll(nodes => [...new Set(nodes.flatMap(node => {
      const image = getComputedStyle(node).backgroundImage;
      return image.startsWith('url("') && image.endsWith('")') ? [image.slice(5, -2)] : [];
    }))]);
    assert.ok(urls.length > 0, 'A prepared lens has actual texture URLs.');
    await page.evaluate(async urls => {
      await Promise.all(urls.map(url => new Promise<void>((done, reject) => {
        const image = new Image(); image.onload = () => done(); image.onerror = () => reject(new Error(`Missing texture: ${url}`)); image.src = url;
      })));
    }, urls);
    return urls.length;
  }
  const focal = () => page.evaluate(() => window.__cssearthTest.physicalCamera('sun').focal);
  const extent = [0, 1, 2].map(axis => Math.max(Math.abs(frame.boundsUnits.min[axis]!), Math.abs(frame.boundsUnits.max[axis]!)));
  /** Same framing rule as the shared nebula delivery run, so the views are comparable. */
  function framingDistance(angle: number, focalPixels: number, axis: 'x' | 'y' = 'y') {
    const cosine = Math.abs(Math.cos(angle)), sine = Math.abs(Math.sin(angle));
    const horizontal = axis === 'y' ? extent[0]! * cosine + extent[2]! * sine : extent[0]!;
    const vertical = axis === 'x' ? extent[1]! * cosine + extent[2]! * sine : extent[1]!;
    const depth = extent[axis === 'y' ? 0 : 1]! * sine + extent[2]! * cosine;
    return Math.max(payload.framingRadiusUnits * 4, depth + focalPixels * Math.max(horizontal / 330, vertical / 400));
  }
  /** Orbit about either local axis, keeping the model origin centered. */
  async function apply(distance: number, angle = 0, axis: 'x' | 'y' = 'y') {
    const pose = cameraPoseToReferenceFrame({
      positionM: axis === 'y'
        ? [-Math.sin(angle) * distance * frame.metersPerUnit, 0, -Math.cos(angle) * distance * frame.metersPerUnit]
        : [0, Math.sin(angle) * distance * frame.metersPerUnit, -Math.cos(angle) * distance * frame.metersPerUnit],
      orientationXyzw: axis === 'y' ? [Math.cos(angle / 2), 0, -Math.sin(angle / 2), 0] : [Math.cos(angle / 2), 0, 0, -Math.sin(angle / 2)],
    }, frame);
    await page.evaluate(({ world, reference }) => window.__cssearthTest.object('sun').camera.applyWorldCamera(world, reference),
      { world: { referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt, pose }, reference: context.frame });
    await settle();
  }
  const cameraState = () => page.evaluate(() => JSON.stringify(window.__cssearthTest.object('sun').camera.state()));

  try {
    const response = await page.goto(`${base}/sun/?focus=${OBJECT_ID}`, { waitUntil: 'domcontentloaded' });
    assert.equal(response?.status(), 200, 'The shared scene must load.');
    await page.waitForFunction(id => window.__sun?.ready && !!document.querySelector(`[data-volume-lens-object="${id}"]`), OBJECT_ID, { timeout: 180_000 });
    const motion = page.locator('input[name="motion"]');
    if (await motion.count() && await motion.isChecked()) await motion.uncheck({ force: true });

    assert.equal(new URL(page.url()).searchParams.get('focus'), OBJECT_ID);
    const controls = page.locator(`[data-focus-lens-bank="${OBJECT_ID}"]`);
    await controls.waitFor({ state: 'visible' });
    const bank = page.locator(`[data-volume-lens-object="${OBJECT_ID}"]`);
    await page.waitForFunction(id => {
      const element = document.querySelector(`[data-volume-lens-object="${id}"]`);
      return element !== null && getComputedStyle(element).display === 'block';
    }, OBJECT_ID, { timeout: 60_000 });
    assert.equal(await bank.evaluate(element => getComputedStyle(element).display), 'block');
    assert.equal(await page.evaluate(() => window.__cssEarth?.mountedObjectCount), 1, 'Exactly one object scene is mounted.');
    assert.equal(await page.locator('.planet-stage').count(), 1, 'The shared stage is unique.');
    assert.equal(await page.locator('.planet-stage .polycss-camera').count(), 1, 'The shared world camera is unique.');
    assert.equal(await page.locator('canvas').count(), 0, 'The volume is rendered without canvas.');
    assert.equal(await controls.locator('[data-focus-lens]').count(), payload.lenses.length, 'Every prepared lens is offered.');

    const focalPixels = await focal();
    const front = framingDistance(0, focalPixels);

    // Each lens: switch, verify the world camera did not move, decode its textures, capture from Earth.
    for (const lens of payload.lenses) {
      await apply(front);
      const before = await cameraState();
      const button = controls.locator(`[data-focus-lens][value="${lens.id}"]`);
      const control = presentation.controls.find(entry => entry.id === lens.id);
      assert.ok(control, `${lens.id}: the presentation must describe every shipped lens.`);
      assert.equal((await button.innerText()).trim(), control.label, 'A dataset row carries only its image name.');
      await button.click();
      await page.waitForFunction(({ id, lens }) => document.querySelector(`[data-volume-lens-object="${id}"]`)?.getAttribute('data-selected-lens') === lens,
        { id: OBJECT_ID, lens: lens.id });
      assert.equal(await cameraState(), before, 'A lens switch moved the world camera.');
      assert.equal(new URL(page.url()).searchParams.get('focusLens'), lens.id);
      const textures = await decodeCssImages(bank.locator(`[data-volume-lens="${lens.id}"]`));
      const sourceIds = [...new Set(provenance.sources.filter(source => source.lensId === lens.id).flatMap(source =>
        source.sourceBinding?.kind === 'catalogued' ? source.sourceBinding.references.filter(reference => reference.role === 'material').map(reference => reference.catalogueId) : []))];
      assert.ok(sourceIds.length > 0, `${lens.id}: identify the original image source.`);
      report.lenses.push({ id: lens.id, label: control.label, textures, cameraRetained: true, sourceIds });
      await capture(`lens-${lens.id}`, 'earth', lens.id, textures);
    }

    // The accepted shape is inspected from Earth, obliquely and at both exact 90-degree side axes.
    const defaultLens = payload.defaultLens;
    await controls.locator(`[data-focus-lens][value="${defaultLens}"]`).click();
    await page.waitForFunction(({ id, lens }) => document.querySelector(`[data-volume-lens-object="${id}"]`)?.getAttribute('data-selected-lens') === lens,
      { id: OBJECT_ID, lens: defaultLens });
    const cloud = bank.locator(`[data-volume-lens="${defaultLens}"]`);
    for (const [name, view, angle] of [['earth', 'earth (0°)', 0], ['oblique', 'oblique (34°)', .6],
      ['side-plus', 'exact +90° side', Math.PI / 2], ['side-minus', 'exact −90° side', -Math.PI / 2]] as const) {
      await apply(framingDistance(angle, focalPixels), angle);
      const textures = await decodeCssImages(cloud);
      await capture(`view-${name}`, view, defaultLens, textures);
    }
    await apply(framingDistance(Math.PI / 2, focalPixels, 'x'), Math.PI / 2, 'x');
    await capture('view-side-y', 'exact local Y-axis side (90° about X)', defaultLens, await decodeCssImages(cloud));

    // Stars are a shared toggle over the same geometry: on, then off, at the Earth view.
    await apply(front);
    const total = await bank.locator('[data-catalogue-source]').count();
    assert.equal(total, payload.lenses[0]!.stars.points.length, 'The prepared catalogue field is mounted in full.');
    report.stars.total = total;
    const stars = controls.locator('[data-focus-stars]');
    assert.equal(await stars.count(), total > 0 ? 1 : 0, 'Only a nonempty compact-light bank offers a stars toggle.');
    if (total > 0) {
      const toggle = controls.locator('label:has([data-focus-stars])');
      if (!await stars.isChecked()) await toggle.click();
      const pointRoot = bank.locator('.prepared-catalogue-points');
      report.stars.rootDisplayOn = await pointRoot.evaluate(element => getComputedStyle(element).display);
      assert.equal(report.stars.rootDisplayOn, 'block');
      report.stars.visibleWithStarsOn = await bank.locator('[data-catalogue-source]')
        .evaluateAll(nodes => nodes.filter(node => getComputedStyle(node).visibility === 'visible').length);
      assert.ok(report.stars.visibleWithStarsOn > 0, 'The prepared stellar field must be visible.');
      await capture('stars-on', 'earth, stars on', defaultLens);
      await toggle.click();
      assert.equal(await stars.isChecked(), false);
      report.stars.rootDisplayOff = await pointRoot.evaluate(element => getComputedStyle(element).display);
      assert.equal(report.stars.rootDisplayOff, 'none');
      await capture('stars-off', 'earth, stars off', defaultLens);
      await toggle.click();

    }
    assert.deepEqual(errors, [], 'The inspected route must raise no page error.');
    assert.deepEqual(failed, [], 'The inspected route must issue no failing request.');
    report.result = 'passed';
  } catch (error) {
    report.result = 'failed';
    report.failure = error instanceof Error ? error.message : String(error);
    await page.screenshot({ path: resolve(directory, 'failure.png') }).catch(() => undefined);
    throw error;
  } finally {
    await write();
    await browser.close();
    console.log(`${LOG}_INSPECTION_${report.result === 'passed' ? 'PASSED' : 'FAILED'} ${resolve(directory, 'inspection.json')}`);
  }
}
