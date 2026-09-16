import { settleCamera, gestureCamera } from './browser-camera.ts';
import { chooseLabObject } from './browser-object-picker.ts';
import assert from 'node:assert/strict';
import { basename } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, type Page } from 'playwright';
import sharp from 'sharp';

declare global { interface Window { __filledLeaves?: Element[]; } }

interface ComparisonImage { id: string; name: string; imagePath: string; }
interface Subject { id: string; directory: string; comparisonGroup?: string; referenceDistanceUnits?: number;
  referenceEastLeft?: boolean; comparisonImages?: ComparisonImage[]; }
interface Resource { path: string; bytes: number; }
interface Descriptor { prepared: { url: string }; properties: { volume: { originM: number[]; metersPerUnit: number } } }
interface Prepared { data: { resources: Resource[] } }
interface Capture { subject: string; pose: string; path: string; distance: number; mean: number; stdev: number; }

const baseURL = process.argv[2] ?? 'http://127.0.0.1:4331';
const output = process.argv[3] ?? '.local/nebula-lab/filled-review/browser';
const screenshots = `${output}/screenshots`;
const expectedIds = ['lmc-clouds-broad', 'lmc-clouds'];
const expectedSources = ['registered-photo', 'target', 'compact', 'extended', 'diffuse'];
const poses = ['reference', 'vertical-negative-wide', 'vertical-negative-short', 'vertical-positive-short', 'vertical-positive-wide',
  'horizontal-negative-wide', 'horizontal-negative-short', 'horizontal-positive-short', 'horizontal-positive-wide', 'vertical-positive-long', 'horizontal-positive-long'] as const;
const earthDistance = 49.59067275049;
const records = JSON.parse(await readFile('labs/nebula/packages/lab/src/state/subjects.json', 'utf8')) as Subject[];
const subjects = expectedIds.map(id => records.find(record => record.id === id));
assert.ok(subjects.every(Boolean), 'Filled comparison subjects are not ready.');
assert.ok(subjects[0]!.comparisonGroup && subjects[0]!.comparisonGroup === subjects[1]!.comparisonGroup,
  'Filled variants must share one comparison group.');
await mkdir(screenshots, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const requests: string[] = [], errors: string[] = [], failedRequests: [number, string][] = [];
page.on('request', request => requests.push(request.url()));
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) failedRequests.push([response.status(), response.url()]); });
const report: { captures: Capture[]; sources: unknown[]; transitions: unknown[]; differences: unknown[];
  errors: string[]; failedRequests: [number, string][]; passed: boolean; failure?: string } =
  { captures: [], sources: [], transitions: [], differences: [], errors, failedRequests, passed: false };

async function waitReady(id: string, mode: 'photo' | 'density') {
  await page.waitForFunction(([subject, expectedMode]) => { const viewer = document.querySelector<HTMLElement>('#viewer');
    return viewer?.dataset.ready === 'true' && viewer.dataset.subject === subject && viewer.dataset.mode === expectedMode;
  }, [id, mode], { timeout: 30000 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function readPrepared(subject: Subject) {
  const descriptor = JSON.parse(await readFile(`${subject.directory}/object.json`, 'utf8')) as Descriptor;
  const prepared = JSON.parse(await readFile(`${subject.directory}/${descriptor.prepared.url}`, 'utf8')) as Prepared;
  return { descriptor, prepared };
}

async function runtimeState() {
  return page.evaluate(() => {
    const viewer = document.querySelector<HTMLElement>('#viewer')!;
    const roots = [...document.querySelectorAll<HTMLElement>('#viewer > .css-volume-projection')];
    const leaves = [...document.querySelectorAll<HTMLElement>('#viewer .css-volume-mesh s')];
    const forbiddenNodes = [...document.querySelectorAll('#viewer canvas, #viewer svg')].map(node => node.nodeName.toLowerCase());
    const forbiddenStyles = [...document.querySelectorAll<HTMLElement>('#viewer *')].flatMap(node => {
      const style = getComputedStyle(node), bad: string[] = [];
      if (style.clipPath !== 'none') bad.push('clip-path');
      if (style.maskImage !== 'none' || style.webkitMaskImage !== 'none') bad.push('mask');
      if (style.filter !== 'none') bad.push('filter');
      if (style.backgroundImage.includes('gradient')) bad.push('gradient');
      if (style.mixBlendMode !== 'normal') bad.push('blend-mode');
      return bad;
    });
    return { subject: viewer.dataset.subject, distance: Number(viewer.dataset.distance), revision: viewer.dataset.cameraRevision,
      pose: JSON.stringify((() => { const m = new DOMMatrix(document.querySelector<HTMLElement>('#viewer .css-volume-scene')!.style.transform); return [[m.m11,m.m12,m.m13],[m.m21,m.m22,m.m23],[m.m31,m.m32,m.m33]].flatMap(row => { const norm = Math.hypot(...row); return row.map(value => Number((value / norm).toFixed(6))); }); })()), hostTransform: getComputedStyle(viewer).transform,
      roots: roots.length, scenes: document.querySelectorAll('#viewer .css-volume-scene').length, leaves: leaves.length,
      transforms: [...document.querySelectorAll<HTMLElement>('#viewer .css-volume-scene')].map(node => node.style.transform),
      textures: leaves.map(node => node.style.backgroundImage), forbiddenNodes, forbiddenStyles };
  });
}

function assertRuntime(value: Awaited<ReturnType<typeof runtimeState>>, id: string) {
  assert.equal(value.roots, 3, `${id}: expected retained x/y/z banks`);
  assert.equal(value.scenes, 3, `${id}: expected one scene per bank`);
  assert.ok(value.leaves > 0, `${id}: no prepared leaves`);
  assert.ok(value.textures.every(texture => texture.includes('/prepared/')), `${id}: runtime fallback texture found`);
  assert.deepEqual(value.forbiddenNodes, [], `${id}: forbidden scene surface`);
  assert.deepEqual(value.forbiddenStyles, [], `${id}: forbidden runtime CSS`);
  assert.match(value.hostTransform, /^matrix\(-1, 0, 0, 1, 0, 0\)$/, `${id}: east-left presentation bridge missing`);
}

async function capture(subject: string, pose: typeof poses[number]) {
  const before = await page.locator('#viewer').getAttribute('data-camera-revision');
  await gestureCamera(page, pose);
  await settleCamera(page);
  if (pose !== 'reference') await page.waitForFunction(value => document.querySelector<HTMLElement>('#viewer')?.dataset.cameraRevision !== value, before);
  const state = await runtimeState(); assertRuntime(state, `${subject}/${pose}`);
  assert.ok(Math.abs(state.distance - earthDistance) < 1e-10, `${subject}/${pose}: observer distance drifted`);
  const retained = await page.evaluate(() => { const now = [...document.querySelectorAll('#viewer .css-volume-mesh s')];
    return Boolean(window.__filledLeaves && now.length === window.__filledLeaves.length && now.every((node, index) => node === window.__filledLeaves![index])); });
  assert.equal(retained, true, `${subject}/${pose}: pose remounted prepared leaves`);
  const path = `${screenshots}/${subject}-${pose}.png`; await page.locator('#viewer').screenshot({ path });
  const stats = await sharp(path).grayscale().stats();
  assert.ok(stats.channels[0]!.mean > .1 && stats.channels[0]!.stdev > .5, `${subject}/${pose}: blank screenshot`);
  const item = { subject, pose, path, distance: state.distance, mean: stats.channels[0]!.mean, stdev: stats.channels[0]!.stdev };
  report.captures.push(item); return item;
}

async function visibleRotation() {
  return page.evaluate(() => {
    const roots = [...document.querySelectorAll<HTMLElement>('#viewer > .css-volume-projection')];
    const root = roots.find(item => getComputedStyle(item).visibility === 'visible' && Number(getComputedStyle(item).opacity) > 0);
    const transform = root?.querySelector<HTMLElement>('.css-volume-scene')?.style.transform;
    if (!transform) throw new Error('No observer-facing scene for drag-direction probe.');
    const matrix = new DOMMatrix(transform);
    return { m23: matrix.m23, m31: matrix.m31 };
  });
}

async function dragDirection(id: string) {
  await gestureCamera(page, 'reference');
  const box = await page.locator('#viewer').boundingBox(); assert.ok(box, `${id}: viewer has no bounds`);
  const drag = async (toFraction: number) => {
    await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5); await page.mouse.down();
    await page.mouse.move(box.x + box.width * toFraction, box.y + box.height * .5, { steps: 12 }); await page.mouse.up();
    await settleCamera(page);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    return visibleRotation();
  };
  const right = await drag(.58);
  // In the front-facing bank's published rotation, m23 and m31 are sin(yaw).
  // The east-left host reflection requires the viewer's conjugated input rotation:
  // screen-right is positive here; removing that conjugation makes these terms negative.
  assert.ok(right.m23 > .05 && right.m31 > .05, `${id}: rightward drag used the wrong east-left yaw sign`);
  await gestureCamera(page, 'reference');
  await settleCamera(page);
  const left = await drag(.42);
  assert.ok(left.m23 < -.05 && left.m31 < -.05, `${id}: leftward drag used the wrong east-left yaw sign`);
  return { right, left, pose: (await runtimeState()).pose };
}

async function sourceAccounting(subject: Subject) {
  const comparisons = new Map((subject.comparisonImages ?? []).map(image => [image.id, image]));
  for (const id of expectedSources) assert.ok(comparisons.has(id), `${subject.id}: source evidence lacks ${id}`);
  const images = await Promise.all(expectedSources.map(async id => {
    const path = comparisons.get(id)!.imagePath, metadata = await sharp(path).metadata();
    assert.ok(metadata.width && metadata.height, `${subject.id}/${id}: source evidence is undecodable`);
    return { id, path, width: metadata.width, height: metadata.height };
  }));
  assert.ok(images.every(image => image.width === images[0]!.width && image.height === images[0]!.height),
    `${subject.id}: evidence images do not preserve one registered projection extent`);
  const target = images.find(image => image.id === 'target')!, extended = images.find(image => image.id === 'extended')!;
  const registered = images.find(image => image.id === 'registered-photo')!;
  const [targetToExtended, registeredToTarget] = await Promise.all([
    imageDifference(target.path, extended.path), imageDifference(registered.path, target.path),
  ]);
  assert.deepEqual(targetToExtended, { meanAbsolute: 0, changedFraction: 0 }, `${subject.id}: target is not the extended-only channel`);
  assert.ok(registeredToTarget.meanAbsolute > .05 && registeredToTarget.changedFraction > .001,
    `${subject.id}: extended target unexpectedly equals the full registered photograph`);
  const analysisPath = `${target.path.slice(0, target.path.lastIndexOf('/'))}/analysis.json`;
  const analysis = JSON.parse(await readFile(analysisPath, 'utf8')) as { channels?: { compact: boolean; diffuse: boolean; extended: boolean } };
  assert.deepEqual(analysis.channels, { compact: false, diffuse: false, extended: true },
    `${subject.id}: prepared target channel accounting drifted`);
  report.sources.push({ subject: subject.id, images, targetToExtended, registeredToTarget, analysisPath });
}

async function imageDifference(leftPath: string, rightPath: string) {
  const [left, right] = await Promise.all([sharp(leftPath).removeAlpha().raw().toBuffer(), sharp(rightPath).removeAlpha().raw().toBuffer()]);
  assert.equal(left.length, right.length); let absolute = 0, changed = 0;
  for (let index = 0; index < left.length; index++) { const delta = Math.abs(left[index]! - right[index]!); absolute += delta; if (delta > 3) changed++; }
  return { meanAbsolute: absolute / left.length, changedFraction: changed / left.length };
}

function htmlEscape(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
}

async function contactSheet(files: string[]) {
  const width = 320, height = 222, columns = 4;
  const thumbs = await Promise.all(files.map(async (path, index) => ({ input: await sharp(path).resize(width, height, { fit: 'cover' }).png().toBuffer(),
    left: index % columns * width, top: Math.floor(index / columns) * height })));
  await sharp({ create: { width: columns * width, height: Math.ceil(files.length / columns) * height, channels: 3, background: '#000' } })
    .composite(thumbs).png().toFile(`${output}/contact-sheet.png`);
  const cards = files.map(path => { const relative = `screenshots/${basename(path)}`;
    return `<a href="${htmlEscape(relative)}"><img src="${htmlEscape(relative)}" alt=""><span>${htmlEscape(basename(path, '.png'))}</span></a>`; }).join('');
  await writeFile(`${output}/contact-sheet.html`, `<!doctype html><meta charset="utf-8"><title>Filled reconstruction review</title><style>body{margin:20px;background:#000;color:#ddd;font:13px system-ui}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}a{color:inherit;text-decoration:none}img{display:block;width:100%;aspect-ratio:1.44;object-fit:cover}span{display:block;padding-top:5px}</style><h1>Filled reconstruction review</h1><div class="grid">${cards}</div>\n`);
}

try {
  const preparedBySubject = new Map<string, Awaited<ReturnType<typeof readPrepared>>>();
  for (const subject of subjects as Subject[]) {
    assert.ok(Math.abs((subject.referenceDistanceUnits ?? 0) - earthDistance) < 1e-10,
      `${subject.id}: declared observer distance differs`);
    assert.equal(subject.referenceEastLeft, true, `${subject.id}: east-left declaration missing`);
    const prepared = await readPrepared(subject); preparedBySubject.set(subject.id, prepared);
    const geometricDistance = Math.hypot(...prepared.descriptor.properties.volume.originM) / prepared.descriptor.properties.volume.metersPerUnit;
    assert.ok(Math.abs(geometricDistance - earthDistance) < 1e-10, `${subject.id}: prepared frame is not at the Earth observer distance`);
    await sourceAccounting(subject);
    await page.goto(`${baseURL}/?subject=${encodeURIComponent(subject.id)}`, { waitUntil: 'domcontentloaded' });
    await waitReady(subject.id, 'density');
    assert.equal(new URL(page.url()).searchParams.get('tab'), 'alignment', `${subject.id}: default tab is not canonical Alignment`);
    assert.equal(await page.locator('[role="tab"]').count(), 2, `${subject.id}: obsolete tabs remain`);
    assert.equal(await page.locator('#density-tab').innerText(), 'Alignment');
    assert.equal(await page.locator('#render-tab').innerText(), 'Reconstruction');
    assert.equal(await page.locator('#density-tab').getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('#density-adjustment-panel').isVisible(), true, `${subject.id}: density controls hidden in Alignment`);
    assert.equal(await page.locator('#image-overlay-panel').isVisible(), true, `${subject.id}: image controls hidden in Alignment`);
    for (const selector of ['#density-tone-brightness', '#overlay-choice', '#overlay-opacity']) {
      assert.equal(await page.locator(selector).isVisible(), true, `${subject.id}: ${selector} hidden in Alignment`);
    }
    const alignmentCamera = await runtimeState();
    assert.ok(Math.abs(alignmentCamera.distance - earthDistance) < 1e-10, `${subject.id}: Alignment camera distance differs`);
    const alignmentPath = `${screenshots}/${subject.id}-alignment.png`; await page.locator('#viewer').screenshot({ path: alignmentPath });
    const requestStart = requests.length;
    await page.click('#render-tab'); await waitReady(subject.id, 'photo');
    assert.equal(new URL(page.url()).searchParams.get('tab'), 'reconstruction', `${subject.id}: Reconstruction URL is not canonical`);
    assert.equal(await page.locator('#density-adjustment-panel').isVisible(), false, `${subject.id}: Alignment controls remain in Reconstruction`);
    const direct = await runtimeState(); assertRuntime(direct, subject.id);
    assert.ok(Math.abs(direct.distance - earthDistance) < 1e-10, `${subject.id}: actual camera distance differs`);
    const loaded = requests.slice(requestStart).filter(url => url.includes(`/${subject.directory}/prepared/`));
    for (const resource of prepared.prepared.data.resources) {
      assert.ok(loaded.some(url => url.endsWith(`/prepared/${resource.path}`)), `${subject.id}: prepared resource was not decoded`);
    }
    await page.evaluate(() => { window.__filledLeaves = [...document.querySelectorAll('#viewer .css-volume-mesh s')]; });
    for (const pose of poses) await capture(subject.id, pose);
    report.transitions.push({ subject: subject.id, drag: await dragDirection(subject.id) });
  }
  await page.goto(`${baseURL}/?subject=${encodeURIComponent(subjects[1]!.id)}&tab=source`, { waitUntil: 'domcontentloaded' });
  await waitReady(subjects[1]!.id, 'density');
  assert.equal(new URL(page.url()).searchParams.get('tab'), 'alignment', 'legacy Source URL did not fall back to Alignment');
  await page.click('#render-tab'); await waitReady(subjects[1]!.id, 'photo');
  await gestureCamera(page, 'horizontal-positive-wide');
  const box = await page.locator('#viewer').boundingBox(); assert.ok(box);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); const beforeZoom = await runtimeState();
  await page.mouse.wheel(0, -350); await page.waitForFunction(distance => Number(document.querySelector<HTMLElement>('#viewer')?.dataset.distance) !== distance, beforeZoom.distance);
  await page.waitForTimeout(350);
  const retained = await runtimeState();
  await chooseLabObject(page, subjects[0]!.id); await waitReady(subjects[0]!.id, 'photo');
  const switched = await runtimeState();
  assert.equal(switched.pose, retained.pose, 'variant switch changed camera pose');
  assert.equal(switched.distance, retained.distance, 'variant switch changed camera distance');
  report.transitions.push({ from: subjects[1]!.id, to: subjects[0]!.id, pose: switched.pose, distance: switched.distance });
  // Both models intentionally preserve the same observer projection; changed depth must be visible off-axis.
  for (const pose of ['reference', 'horizontal-positive-wide']) {
    const pair = report.captures.filter(item => item.pose === pose);
    const difference = await imageDifference(pair[0]!.path, pair[1]!.path);
    if (pose !== 'reference') assert.ok(difference.meanAbsolute > .05 && difference.changedFraction > .001,
      'broad and filled oblique projections are visually identical');
    report.differences.push({ pair: expectedIds, pose, ...difference });
  }
  assert.deepEqual(errors, []); assert.deepEqual(failedRequests, []);
  await contactSheet(report.captures.map(item => item.path));
  report.passed = true;
} catch (error) { report.failure = error instanceof Error ? error.stack ?? error.message : String(error); }

await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
console.log('FILLED_BROWSER_COMPLETE', JSON.stringify({ passed: report.passed, captures: report.captures.length,
  sourcePanels: report.sources.length, differences: report.differences.length }));
await browser.close();
process.exit(report.passed ? 0 : 1);
