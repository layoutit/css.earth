/** One arm in the real site: a data-only swap of the installed bank, with the accepted bank restored byte for byte afterwards. */
import { access, cp, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { openSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { validatePreparedCssVolume, type PreparedCssVolume } from '@cssearth/objects';
import { inventoryPreparedAssets, readVolumeDatasetBank, writeVolumeDatasetBank } from '@cssearth/objects/node';
import { prepareCatalog } from '../../../../../site/build/prepare/catalog/prepare-catalog.mts';
import { siteViewLinks } from '../delivery/site-views.mts';
import { cameraUrl, pilotCamera } from '../piece-pilot/cameras.mts';
import { mul } from '../geometry.mts';
import { withPreviewLease } from '../shape-pilot/preview-lease.mts';
import { composeFiniteComponents } from '../shape-pilot/component-bank.mts';
import { json, need } from '../inputs.mts';
import { BACKGROUND_DIR } from './background.mts';
import { DOTS_DIR } from './dots.mts';
import { ALL_DIR } from './dots-all.mts';
import { ALL_BACKGROUND_DIR, SMOOTH_BACKGROUND_DIR } from './background-all.mts';
import { L37_DIR, PILOT_REGIONS } from './regions.mts';
import { SPRITES_DIR } from './sprites.mts';
import { milkyWayOnScreen } from './opening-view.mts';
import { alignmentReport, backingReport } from './alignment.mts';
import { discBacking, type BackingRecord } from './backing-disc.mts';

const OWNER_VIEWS = { A: 'UYNDKid65ZoPsMM7jkKo0rK7w8M2LdAC0JFBQsczQAAAAEAYLePdTsc_v-SEPg9eQck_xhiBrVRtdb-y9jlCd__kAAA', B: 'UYNDKid65ZoPsMM7jkKo0rK7w8M2LdAC0JFBQsczQAAAAEAYLePdTsc_v-SKn2nq6Q0_tAI9Dr8Hnz95Xl0j650cAAA', C: 'UYNDKid65ZoPsMM7jkKo0rK7w8M2LdAC0JFBQsczQAAAAEAYLePdTsc_v-QgFFSGD4y_eediPfXx6D-zirDngHj0AAA' };
export const STOP_FILE = L37_DIR + 'stop-live', ORIGIN = 'http://127.0.0.1:4313';
const object = 'src/objects/lmc-volume/', prepared = object + 'prepared', backup = L37_DIR + 'accepted-backup', stage = L37_DIR + 'site-stage', original = L37_DIR + 'original/';
const exists = (path: string) => access(path).then(() => true, () => false);
const CONTEXT = 'site/prepared/prepared-context-bank-assets.json';
interface PresentationRecord { id: string; input: string; label: string; title: string; description: string; sourceUrl: string }
const GRADE_ARMS = { 'decam-smash': 'decam', 'vista-vmc': 'vista' } as const;
/** A graded dataset is the same volume on its own textures, gas dots and far pictures, so the shared topology swaps them on one surface. */
async function gradedDatasets(first: Awaited<ReturnType<typeof readVolumeDatasetBank>>['datasets'][number], stageDir: string, records: PresentationRecord[]) {
  const out = [];
  for (const id of ['decam-smash', 'vista-vmc'] as const) {
    const arm = GRADE_ARMS[id], text = records.find(r => r.id === id)!, near = L37_DIR + 'background-' + arm + '/bank/', far = L37_DIR + 'grades/' + arm + '-far/', dots = L37_DIR + 'dots-' + arm + '/', rename = (path: string) => path.replace(/^l36-near\//u, arm + '-near/').replace(/^l36-far\//u, arm + '-far/');
    const resources = await Promise.all(first.volume.resources.map(async r => { const next = rename(r.path), from = r.path.startsWith('l36-near/') ? near + r.path.slice(9) : far + r.path.slice(8); await mkdir(dirname(stageDir + '/' + next), { recursive: true }); await writeFile(stageDir + '/' + next, await readFile(from)); return { ...r, path: next, bytes: (await stat(from)).size }; }));
    for (const name of ['gas-dots-' + arm + '.bin', 'gas-dots-' + arm + '-atlas.webp']) await writeFile(stageDir + '/' + name, await readFile(dots + name));
    const swap = <T extends { texturePath: string }>(leaf: T) => ({ ...leaf, texturePath: rename(leaf.texturePath) });
    const volume = validatePreparedCssVolume({ ...first.volume, pointOverlays: ['gas-dots-' + arm + '.bin'], resources, stacks: first.volume.stacks.map(s => ({ ...s, leaves: s.leaves.map(swap) })), impostors: { ...first.volume.impostors!, views: first.volume.impostors!.views.map(swap) } });
    out.push({ ...first, id, label: text.label, title: text.title, description: text.description, sourceUrl: text.sourceUrl, volume });
  }
  return out;
}
/** The owning preparation commands, over the stage's three-dataset bank: the sidebar, its text and the facility graph come from source records. */
function prepareHost() {
  for (const args of [['site/build/prepare/catalog/prepare-volume-presentation.mts', '--object=lmc-volume'], ['site/build/prepare/authored/prepare-authored.ts', 'lmc', '--write', '--full'], ['site/build/prepare/authored/prepare-text.mts', 'lmc'], ['site/build/prepare/authored/prepare-object-json.mts', 'lmc'], ['packages/bake/cli/prepare-dataset-sprites.mts'], ['site/build/prepare/catalog/prepare-facilities.mts', '--catalog-only']]) execFileSync(process.execPath, args, { stdio: 'inherit' });
}
export async function restoreAccepted() {
  if (!await exists(backup)) return;
  const inventory = await readFile(original + 'inventory.json'), context = await readFile(original + 'context.json'), descriptor = await readFile(original + 'object.json');
  await rm(prepared, { recursive: true, force: true }); await rename(backup, prepared); await writeFile(object + 'inventory.json', inventory); await writeFile(object + 'object.json', descriptor); await prepareCatalog();
  need((await readFile(object + 'inventory.json')).equals(inventory) && (await readFile(object + 'object.json')).equals(descriptor) && (await readFile(CONTEXT)).equals(context), 'The accepted bank did not restore exactly');
  console.log('GAS_ACCEPTED_BANK_RESTORED');
}

type Arm = 'accepted' | 'dots' | 'sprites' | 'all' | 'gasfree' | 'align' | 'decam' | 'vista' | 'datasets';
const graded = (arm: Arm) => arm === 'decam' || arm === 'vista', dotted = (arm: Arm) => arm === 'all' || graded(arm) || arm === 'datasets';
const HANDOVER = [.15, .65] as const, DISC_PLANE = { right: [1, 0, 0] as [number, number, number], up: [0, 1, 0] as [number, number, number] };
async function armVolume(arm: Arm, native: PreparedCssVolume): Promise<{ volume: PreparedCssVolume; copies: [string, string][] }> {
  if (arm === 'accepted') return { volume: native, copies: [] };
  // Geometry only: the accepted slabs and pictures hold one model, and the pictures stay mounted at any size.
  if (arm === 'align') return { volume: validatePreparedCssVolume({ ...native, impostors: { ...native.impostors!, discPlane: DISC_PLANE, fullBelowDiameterPixels: 1, volumeAboveDiameterPixels: 20000 } }), copies: [] };
  const copies: [string, string][] = [];
  const resources = await Promise.all(native.resources.map(async r => { if (graded(arm) && r.path.startsWith('l36-far/')) return { ...r, bytes: (await stat(L37_DIR + 'grades/' + arm + '-far/' + r.path.slice('l36-far/'.length))).size }; if (!r.path.startsWith('l36-near/')) return r; const from = (arm === 'datasets' ? SMOOTH_BACKGROUND_DIR : graded(arm) ? L37_DIR + 'background-' + arm + '/' : arm === 'all' ? SMOOTH_BACKGROUND_DIR : arm === 'gasfree' ? ALL_BACKGROUND_DIR : BACKGROUND_DIR) + 'bank/' + r.path.slice('l36-near/'.length); copies.push([from, r.path]); return { ...r, bytes: (await stat(from)).size }; }));
  const background = validatePreparedCssVolume({ ...native, resources });
  if (arm === 'gasfree') return { volume: background, copies };
  if (arm === 'datasets') { for (const name of ['gas-dots.bin', 'gas-dots-atlas.webp']) copies.push([L37_DIR + 'dots-all/' + name, name]); return { volume: validatePreparedCssVolume({ ...background, pointOverlays: ['gas-dots.bin'], thinHandoverCosines: HANDOVER, stackCompositing: 'transparent-normalized', impostors: { ...background.impostors!, discPlane: DISC_PLANE } }), copies }; }
  if (dotted(arm)) { if (graded(arm)) for (const r of native.resources) if (r.path.startsWith('l36-far/')) copies.push([L37_DIR + 'grades/' + arm + '-far/' + r.path.slice('l36-far/'.length), r.path]); for (const name of ['gas-dots.bin', 'gas-dots-atlas.webp']) copies.push([ALL_DIR + name, name]); return { volume: validatePreparedCssVolume({ ...background, pointOverlays: ['gas-dots.bin'], thinHandoverCosines: HANDOVER, stackCompositing: 'transparent-normalized', impostors: { ...background.impostors!, discPlane: DISC_PLANE } }), copies }; }
  if (arm === 'dots') { for (const name of ['gas-dots.bin', 'gas-dots-atlas.webp']) copies.push([DOTS_DIR + name, name]); return { volume: validatePreparedCssVolume({ ...background, pointOverlays: ['gas-dots.bin'] }), copies }; }
  const parts = await Promise.all(PILOT_REGIONS.map(async r => ({ id: r.id, volume: validatePreparedCssVolume(await json(SPRITES_DIR + r.id + '/volume.json')) })));
  for (const part of parts) for (const res of part.volume.resources) copies.push([SPRITES_DIR + part.id + '/' + res.path.slice(res.path.indexOf('/') + 1), res.path]);
  return { volume: composeFiniteComponents(background, parts), copies };
}

const toLinear = (v: number) => { const x = v / 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; };
/** Light the gas adds over the gas-free slabs, against what the accepted delivery adds over them: whole frame and per group. */
async function measureLight(id: string, withGas: Buffer, dustOnly: Buffer, without: Buffer, rects: { cell: number[]; box: number[] }[]) {
  const read = async (input: Buffer | string) => (await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true }));
  const G = await read(withGas), B = await read(dustOnly), W = await read(without), R = await read(L37_DIR + 'accepted/' + id + '.png'), F = await read(L37_DIR + 'gasfree/' + id + '.png'), w = G.info.width, h = G.info.height;
  const sum = (A: typeof G, box: number[], Z: typeof G = B) => { let s = 0; for (let y = Math.max(0, Math.floor(box[1]!)); y < Math.min(h, box[3]!); y++) for (let x = Math.max(0, Math.floor(box[0]!)); x < Math.min(w, box[2]!); x++) { const i = (y * w + x) * 3; for (let k = 0; k < 3; k++) s += toLinear(A.data[i + k]!) - toLinear(Z.data[i + k]!); } return s; };
  const info = JSON.parse(await readFile(ALL_DIR + 'result.json', 'utf8')) as { groupIds: string[] }, across = Math.ceil(Math.sqrt(rects.length)), boxes = new Map<string, number[]>();
  for (const r of rects) { const g = info.groupIds[r.cell[1]! / 128 * across + r.cell[0]! / 128]; if (!g) continue; const b = boxes.get(g); boxes.set(g, b ? [Math.min(b[0]!, r.box[0]!), Math.min(b[1]!, r.box[1]!), Math.max(b[2]!, r.box[2]!), Math.max(b[3]!, r.box[3]!)] : [...r.box]); }
  const groups: Record<string, [number, number]> = {}; for (const [g, box] of boxes) if (box[2]! > 0 && box[3]! > 0 && box[0]! < w && box[1]! < h) groups[g] = [sum(G, box), sum(R, box, F)];
  const whole = [0, 0, w, h], all = sum(G, whole), ref = sum(R, whole, F);
  const dark = sum(W, whole, B), darkRef = sum(W, whole, F);
  return { id, added: all, referenceAdded: ref, ratio: all / ref, groups, darkening: dark, referenceDarkening: darkRef, darkeningRatio: dark / darkRef };
}

/** A real wheel zoom out through the handoff in one page: the bright centroid on screen against where the frame's centre should be. */
async function zoomPath(page: import('playwright').Page, errors: string[]) {
  await page.goto(ORIGIN + '/lmc/', { waitUntil: 'domcontentloaded', timeout: 180000 }); await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', {}, { timeout: 180000 }); await page.waitForTimeout(2500);
  const rows: { diameter: number; mix: string; x: number; y: number; expected: [number, number]; light: number }[] = []; await page.mouse.move(512, 384);
  for (let i = 0; i < 45; i++) {
    await page.mouse.wheel(0, -24); await page.waitForTimeout(600);
    const state = await page.evaluate(() => { const bank = document.querySelector<HTMLElement>('[data-volume-dataset-object="lmc-volume"]'), k = document.querySelector<HTMLElement>('[data-galaxy-backing="lmc-volume"]'), rect = k?.querySelector('img')?.getBoundingClientRect(), view = Reflect.get(Reflect.get(window, '__lmc') as object, 'runtime') as { view(): { zoom: number } }; return { diameter: rect ? rect.width : 0, centre: rect ? [(rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2] : null, zoom: view.view().zoom, detailOpacity: 'bank ' + (bank ? getComputedStyle(bank).display + ' ' + (+getComputedStyle(bank).opacity).toFixed(2) : '') + ' backing ' + (k ? getComputedStyle(k).display + ' ' + (+getComputedStyle(k).opacity).toFixed(2) : '') + ' ' + location.pathname }; });
    const { data, info } = await sharp(await page.screenshot()).removeAlpha().resize(256).greyscale().blur(2).raw().toBuffer({ resolveWithObject: true }); let sum = 0, sx = 0, sy = 0; for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) { const v = data[y * info.width + x]!; if (v > 18) { sum += v; sx += v * x; sy += v * y; } }
    rows.push({ light: sum, diameter: state.zoom * 1000, mix: state.detailOpacity, x: sum ? sx / sum * 1024 / 256 : 0, y: sum ? sy / sum * 1024 / 256 : 0, expected: (state.centre ?? [0, 0]) as [number, number] });
  }
  const shown = rows.filter(r => r.diameter > 0), step = (a: (r: typeof rows[number]) => [number, number]) => Math.max(0, ...shown.slice(1).map((r, i) => Math.hypot(a(r)[0] - a(shown[i]!)[0], a(r)[1] - a(shown[i]!)[1])));
  const step0 = (list: typeof rows) => Math.max(0, ...list.slice(1).map((r, i) => Math.hypot(r.expected[0] - list[i]!.expected[0], r.expected[1] - list[i]!.expected[1])));
  const through = rows.filter(r => /bank block 0\.[1-9]/u.test(r.mix)).length, result = { samples: rows.length, samplesWithBillboard: shown.length, samplesInHandoff: through, diameters: [shown[0]?.diameter, shown.at(-1)?.diameter], largestCentreStepPx: step0(rows.filter(r => r.expected[0] !== 0)), largestLightCentroidStepPx: step(r => [r.x, r.y]), surfaceBrightnessAboveAndBelowHandoff: [shown.filter(r => r.diameter >= 256).at(-1), shown.find(r => r.diameter <= 128)].map(r => r ? r.light / r.diameter ** 2 : null), rows: rows.map(r => [Math.round(r.diameter), r.mix, Math.round(r.x), Math.round(r.y), Math.round(r.expected[0]), Math.round(r.expected[1]), Math.round(r.light)]) };
  await writeFile(ALL_DIR + 'zoom.json', JSON.stringify(result) + '\n'); console.log('GAS_ZOOM ' + JSON.stringify({ ...result, rows: undefined })); if (!rows.some(r => /bank block 0\.[1-9]/u.test(r.mix))) errors.push('The zoom did not cross the handoff');
}

/** Exactly edge-on through the handoff: what is drawn, and its light against the same camera a little above the disc. */
async function edgeHold(page: import('playwright').Page, errors: string[]) {
  const rows = [];
  for (const tilt of [90, 75]) for (const distance of [20, 46, 90, 180, 360, 700]) {
    const base = pilotCamera('edge', 128, [0, 0, 0], 10, tilt, 0), eye = mul(base.back, distance);
    await page.goto(await cameraUrl(ORIGIN, { ...base, distance, eye, focal: 128 * Math.sqrt(3) / 2 }), { waitUntil: 'domcontentloaded', timeout: 180000 }); await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', {}, { timeout: 180000 }); await page.waitForTimeout(3500);
    const state = await page.evaluate(() => { const b = document.querySelector<HTMLElement>('[data-volume-dataset-object="lmc-volume"]'), k = document.querySelector<HTMLElement>('[data-galaxy-backing="lmc-volume"]'), i = k?.querySelector('img')?.getBoundingClientRect(); return { bank: b ? getComputedStyle(b).display + ' ' + (+getComputedStyle(b).opacity).toFixed(2) : 'none', detail: b?.querySelector<HTMLElement>('.css-volume-detail') ? getComputedStyle(b.querySelector<HTMLElement>('.css-volume-detail')!).display : 'none', pictures: b ? [...b.querySelectorAll<HTMLElement>('.css-volume-impostors s')].filter(n => n.style.display === 'block').map(n => n.dataset.volumeImpostor + ' ' + n.style.opacity + ' ' + parseInt(n.style.width)) : [], backing: k ? getComputedStyle(k).display + ' ' + (+getComputedStyle(k).opacity).toFixed(2) + ' h' + (i ? i.height | 0 : 0) : 'none' }; });
    const { data, info } = await sharp(await page.screenshot({ clip: { x: 262, y: 184, width: 500, height: 400 } })).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true }); let sum = 0; for (const v of data) if (v > 24) sum += v;
    rows.push({ tilt, distance, ...state, light: Math.round(sum / 1000), lit: info.width });
  }
  await writeFile(ALL_DIR + 'edge.json', JSON.stringify(rows) + '\n'); console.log('GAS_EDGE ' + JSON.stringify(rows)); const flat = rows.filter(r => r.tilt === 90 && r.distance <= 180); if (flat.some(r => r.light === 0)) errors.push('The edge-on galaxy is gone');
}

/** The whole frame from Earth in the real site, in linear light, against the reference picture where it holds data. */
async function imageLight(page: import('playwright').Page, arm: Arm) {
  const { targetSize: [w, h] } = JSON.parse(await readFile(L37_DIR + 'grades/' + arm + '.json', 'utf8')) as { targetSize: [number, number] }, raw = await readFile(L37_DIR + 'grades/' + arm + '-target.f32le'), target = new Float32Array(Uint8Array.from(raw).buffer);
  await page.goto((await siteViewLinks(ORIGIN))[0]!.url + '&embed', { waitUntil: 'domcontentloaded', timeout: 180000 }); await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', {}, { timeout: 180000 }); await page.waitForTimeout(6000);
  const { data } = await sharp(await page.screenshot()).removeAlpha().resize(w, h).raw().toBuffer({ resolveWithObject: true }), L = (v: number) => { const x = v / 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }; let site = 0, image = 0;
  for (let p = 0; p < target.length; p++) if (target[p]! >= 0) { site += .2126 * L(data[p * 3]!) + .7152 * L(data[p * 3 + 1]!) + .0722 * L(data[p * 3 + 2]!); image += target[p]!; }
  console.log('GRADE_LIGHT ' + JSON.stringify({ arm, siteOverImage: +(site / image).toFixed(3) }));
}

/** Each dataset clicked in the real sidebar, there and back, with its own textures and nobody else's. */
async function datasetChecks() {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }), errors: string[] = [], rows: Record<string, unknown>[] = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
    await page.goto(ORIGIN + '/lmc/', { waitUntil: 'domcontentloaded', timeout: 180000 }); await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', {}, { timeout: 90000 }).catch(() => console.log('GAS_DATASET_NOT_READY errors ' + errors.slice(0, 6).join(' | ').slice(0, 900))); await page.waitForFunction(() => document.querySelectorAll('.prepared-cloud-points > div').length > 0, {}, { timeout: 60000 }).catch(async () => { console.log('GAS_DATASET_NO_BOARDS ' + JSON.stringify(await page.evaluate(() => { const b = document.querySelector<HTMLElement>('[data-volume-dataset-object="lmc-volume"]'); return { ready: document.documentElement.dataset.ready, bank: b && getComputedStyle(b).display + ' ' + getComputedStyle(b).opacity, selected: b?.dataset.selectedDataset, layers: b?.querySelectorAll('.css-volume-detail s').length, loading: document.querySelector<HTMLElement>('.object-datasets')?.dataset.datasetLoading, text: document.querySelector('.object-datasets')?.textContent?.slice(0, 200) }; })) + ' errors ' + errors.slice(0, 6).join(' | ').slice(0, 900)); }); await page.waitForTimeout(1500);
    if (!await page.evaluate(() => document.querySelector('[data-volume-dataset-object="lmc-volume"]') !== null)) { errors.push('The bank never mounted: ' + JSON.stringify(await page.evaluate(() => Reflect.get(window, '__CSSEARTH_CONTEXT_AVAILABILITY__')))); return; }
    const read = () => page.evaluate(() => { const bank = document.querySelector<HTMLElement>('[data-volume-dataset-object="lmc-volume"]')!, urls = [...bank.querySelectorAll<HTMLElement>('.css-volume-detail s')].flatMap(n => [...getComputedStyle(n).backgroundImage.matchAll(/url\("?([^"\)]+)"?\)/gu)].map(m => m[1]!)), boards = [...document.querySelectorAll<HTMLElement>('.prepared-cloud-points > div')], atlas = [...new Set(boards.map(n => getComputedStyle(n).backgroundImage))], view = (Reflect.get(Reflect.get(window, '__lmc') as object, 'runtime') as { view(): { worldCamera: { pose: { orientationXyzw: number[]; positionM: number[] } } } }).view().worldCamera.pose, active = document.querySelector<HTMLElement>('.object-dataset-picker [aria-current], .object-dataset-picker [aria-pressed="true"], .object-dataset-picker [aria-checked="true"], .object-dataset-picker input:checked')?.closest('[data-dataset-option]'); return { url: location.pathname + location.search, selected: bank.dataset.selectedDataset, sets: [...new Set(urls.map(u => /(l36|decam|vista)-near/u.exec(u)?.[1] ?? 'other'))], layers: urls.length, overlays: document.querySelectorAll('.prepared-cloud-points').length, boards: boards.length, atlas: atlas.map(a => /gas-dots[a-z-]*-atlas/u.exec(a)?.[0] ?? a.slice(0, 60)), retained: bank.querySelectorAll('*').length, pose: [...view.orientationXyzw, ...view.positionM], option: active?.textContent?.slice(0, 60), sidebar: document.querySelector('.object-datasets')?.textContent?.slice(0, 240), rail: [...document.querySelectorAll<HTMLElement>('.object-dataset-context-rail')].map(n => n.textContent?.slice(0, 200)).join(' | ') }; });
    const labels = ['DECam · optical', 'VISTA · near infrared', 'Horálek · optical', 'VISTA · near infrared', 'DECam · optical', 'Horálek · optical', 'DECam · optical']; let pose: number[] | null = null;
    console.log('GAS_DATASET_START ' + JSON.stringify(await read()));
    for (const label of labels) { await page.locator('.object-dataset-picker').getByText(label, { exact: true }).first().click(); await page.waitForTimeout(3500); const s = await read(); if (!pose) pose = s.pose; const moved = Math.max(...s.pose.map((v, i) => Math.abs(v - pose![i]!) / Math.max(1, Math.abs(pose![i]!)))); const hasText = (s.sidebar ?? '').includes(label); rows.push({ label, ...s, pose: undefined, moved, hasText }); console.log('GAS_DATASET ' + JSON.stringify({ label, ...s, pose: undefined, moved })); }
    for (const id of ['horalek-widefield', 'decam-smash', 'vista-vmc']) {
      await page.goto(ORIGIN + '/lmc/?dataset=' + id, { waitUntil: 'domcontentloaded', timeout: 180000 }); await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', {}, { timeout: 90000 }); await page.waitForTimeout(2500);
      const panel = await page.evaluate(i => { const row = document.getElementById('lmc-' + i + '-option'), img = row?.querySelector('img'), text = document.body.innerText; return { id: i, row: row?.textContent?.slice(0, 90), thumbnail: img ? [img.getAttribute('src') ?? img.src, img.naturalWidth] : [...document.querySelectorAll<HTMLElement>('.object-dataset-picker *')].map(n => getComputedStyle(n).backgroundImage).filter(v => v !== 'none').slice(0, 3), card: document.querySelector('.object-sidebar p')?.textContent?.slice(0, 110), rail: [...document.querySelectorAll<HTMLElement>('.object-dataset-context-rail')].map(n => n.textContent?.slice(0, 180)).join(' | '), internal: ['l36', 'native', 'approved', 'accepted', 'slab approximation', 'residual failure'].filter(w => text.toLowerCase().includes(w)), graded: /graded to/i.test(text), outside: /outside its frame/i.test(text) }; }, id);
      await page.getByText('Sources', { exact: true }).first().click().catch(() => errors.push('No Sources tab')); await page.waitForTimeout(900);
      const sources = await page.evaluate(() => { const links = [...document.querySelectorAll<HTMLAnchorElement>('a[href]')].map(a => a.href), text = document.body.innerText; return { eso1914a: links.some(u => u.includes('eso1914a')), noirlab2030a: links.some(u => u.includes('noirlab2030a')), iotw2547a: links.some(u => u.includes('iotw2547a')), vmc: text.includes('ESO/VMC'), smash: text.includes('SMASH'), internal: ['l36', 'approved', 'accepted'].filter(w => text.toLowerCase().includes(w)) }; });
      console.log('GAS_PANEL ' + JSON.stringify({ ...panel, sources }));
    }
  } finally { await browser.close(); }
  await writeFile(L37_DIR + 'datasets.json', JSON.stringify({ errors, rows }, null, 1) + '\n'); console.log('GAS_DATASETS_DONE errors=' + errors.length + ' ' + errors.slice(0, 4).join(' | '));
}

/** Both entries, by state: opening /lmc/ and clicking it from the Milky Way's page, and where the Milky Way's centre falls. */
async function entryPoses(page: import('playwright').Page, errors: string[]) {
  const read = () => page.evaluate(() => { const bank = document.querySelector<HTMLElement>('[data-volume-dataset-object="lmc-volume"]'), roots = bank ? [...bank.querySelectorAll<HTMLElement>('.css-volume-projection')].slice(0, 3).map(n => +Number(getComputedStyle(n).opacity).toFixed(3)) : []; const volume = { layers: bank?.querySelectorAll('.css-volume-detail s').length ?? 0, boards: document.querySelectorAll('.prepared-cloud-points > div').length, bank: bank && getComputedStyle(bank).display + ' ' + getComputedStyle(bank).opacity, axes: roots, backing: [...document.querySelectorAll<HTMLElement>('[data-galaxy-backing="lmc-volume"]')].map(n => getComputedStyle(n).display + ' ' + (+getComputedStyle(n).opacity).toFixed(2)).join() }; for (const key of Object.keys(window)) if (key.startsWith('__')) { const api = Reflect.get(window, key) as { runtime?: { view?: () => { worldCamera: unknown; stageViewport: unknown } } } | null, view = api?.runtime?.view?.(); if (view) return { key, volume, world: view.worldCamera, viewport: view.stageViewport, href: location.pathname }; } return null; }) as Promise<{ key: string; volume: Record<string, unknown>; world: { pose: { positionM: [number, number, number]; orientationXyzw: [number, number, number, number]; focusOffset?: { offsetM: number[] } } }; viewport: { focalPixels: number; widthPixels: number; heightPixels: number }; href: string } | null>;
  const summary = (v: NonNullable<Awaited<ReturnType<typeof read>>>) => { const at = milkyWayOnScreen(v.world.pose.positionM, v.world.pose.orientationXyzw, v.viewport.focalPixels); const distanceKpc = Math.hypot(...(v.world.pose.focusOffset?.offsetM ?? [0, 0, 0])) / 3.0856775814913673e19; return { href: v.href, ...v.volume, framingRadiusPx: Math.round(v.viewport.focalPixels * 5 / distanceKpc), orientation: v.world.pose.orientationXyzw.map(q => +q.toFixed(5)), distanceKpc: +(Math.hypot(...(v.world.pose.focusOffset?.offsetM ?? [0, 0, 0])) / 3.0856775814913673e19).toFixed(2), milkyWayPx: at && at.map(x => Math.round(x)), halfFrame: [v.viewport.widthPixels / 2, v.viewport.heightPixels / 2], inFrame: !!at && Math.abs(at[0]) < v.viewport.widthPixels / 2 && Math.abs(at[1]) < v.viewport.heightPixels / 2 }; };
  const ready = () => page.waitForFunction(() => document.documentElement.dataset.ready === 'true', {}, { timeout: 180000 });
  await page.goto(ORIGIN + '/lmc/', { waitUntil: 'domcontentloaded', timeout: 180000 }); await ready(); await page.waitForTimeout(9000); const direct = await read();
  await page.goto(ORIGIN + '/milky-way/', { waitUntil: 'domcontentloaded', timeout: 180000 }); await ready(); await page.waitForTimeout(1500);
  await page.evaluate(() => { const a = [...document.querySelectorAll<HTMLAnchorElement>('a[href]')].find(n => n.getAttribute('href') === '/lmc/'); if (!a) throw Error('No LMC link'); a.click(); });
  await page.waitForFunction(() => location.pathname.startsWith('/lmc'), {}, { timeout: 60000 }).catch(() => errors.push('Click did not reach /lmc/')); await page.waitForTimeout(14000); const clicked = await read();
  const earth = await (async () => { await page.goto((await siteViewLinks(ORIGIN))[0]!.url + '&embed', { waitUntil: 'domcontentloaded', timeout: 180000 }); await ready(); await page.waitForTimeout(1500); return read(); })();
  const result = { direct: direct && summary(direct), clicked: clicked && summary(clicked), savedEarth: earth && summary(earth) };
  await writeFile(ALL_DIR + 'entries.json', JSON.stringify(result, null, 1) + '\n'); console.log('GAS_ENTRIES ' + JSON.stringify(result));
}

/** A real drag from view A in one page, with no reload: root and slice opacities and memberships as the DOM computes them, and the frame's mean light. */
async function dragPath(page: import('playwright').Page, errors: string[]) {
  const read = () => page.evaluate(() => { const detail = document.querySelector<HTMLElement>('[data-volume-dataset-object="lmc-volume"] .css-volume-detail')!, roots = [...detail.querySelectorAll<HTMLElement>('.css-volume-projection')].slice(0, 3); return roots.map(root => { const rootOpacity = Number(getComputedStyle(root).opacity), shown = getComputedStyle(root).display !== 'none', leaves = [...root.querySelectorAll<HTMLElement>('s')].map(n => { const c = getComputedStyle(n); let visible = c.display !== 'none' && c.visibility !== 'hidden'; for (let p = n.parentElement; p && p !== root && visible; p = p.parentElement) visible = getComputedStyle(p).display !== 'none'; return visible ? Number(c.opacity) : -1; }); return { rootOpacity: shown ? rootOpacity : 0, leaves }; }); });
  const settle = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 60)))));
  const light = async () => { const { data } = await sharp(await page.screenshot({ type: 'png' })).removeAlpha().resize(256).raw().toBuffer({ resolveWithObject: true }); let s = 0; for (let i = 0; i < data.length; i++) { const x = data[i]! / 255; s += x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; } return s / data.length; };
  for (const sign of [1, -1]) {
    await page.goto(ORIGIN + '/lmc/?v=' + OWNER_VIEWS.A, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', {}, { timeout: 180000 });
    await page.waitForFunction(() => document.querySelectorAll('[data-volume-dataset-object="lmc-volume"] .css-volume-detail s').length === 33, {}, { timeout: 120000 }); await new Promise(r => setTimeout(r, 1500));
    const rows: { roots: number[]; visible: number[]; leaves: number[][]; light: number }[] = [], x = 512; let y = 384;
    await page.mouse.move(x, y); await page.mouse.down();
    for (let i = 0; i < 70; i++) { y += sign * 6; if (y < 20 || y > 750) { await page.mouse.up(); y = 384; await page.mouse.move(x, y); await page.mouse.down(); } await page.mouse.move(x, y); await settle(); const state = await read(); rows.push({ roots: state.map(s => s.rootOpacity), visible: state.map(s => s.leaves.filter(v => v >= 0).length), leaves: state.map(s => s.leaves), light: await light() }); if (state[2]!.rootOpacity === 0 && rows.length > 24) break; }
    await page.mouse.up(); await page.waitForTimeout(100);
    const z = rows.map(r => r.roots[2]!); if (!(z.at(-1)! < .5)) continue;
    const step = (a: number) => Math.max(0, ...rows.slice(1).map((r, i) => Math.abs(r.roots[a]! - rows[i]!.roots[a]!)));
    let leafStep = 0, popWhile = 0; for (let i = 1; i < rows.length; i++) for (let a = 0; a < 3; a++) rows[i]!.leaves[a]!.forEach((v, k) => { const p = rows[i - 1]!.leaves[a]![k]!, now = (v < 0 ? 0 : v) * rows[i]!.roots[a]!, was = (p < 0 ? 0 : p) * rows[i - 1]!.roots[a]!; leafStep = Math.max(leafStep, Math.abs(now - was)); if ((v < 0) !== (p < 0)) popWhile = Math.max(popWhile, Math.max(rows[i]!.roots[a]!, rows[i - 1]!.roots[a]!) * Math.max(v, p)); });
    const totals = rows.map(r => r.roots[0]! + r.roots[1]! + r.roots[2]!), lights = rows.map(r => r.light);
    const result = { samples: rows.length, maxStepPerAxis: { x: step(0), y: step(1), z: step(2) }, maxEffectiveSliceStep: leafStep, largestOpacityAtAMembershipChange: popWhile, rootShareRange: [Math.min(...totals), Math.max(...totals)], light: { min: Math.min(...lights), max: Math.max(...lights), maxStep: Math.max(...lights.slice(1).map((v, i) => Math.abs(v - lights[i]!))) }, roots: rows.map(r => r.roots.map(v => +v.toFixed(3))), visible: rows.map(r => r.visible), errors: errors.length };
    await writeFile(ALL_DIR + 'path.json', JSON.stringify(result) + '\n'); console.log('GAS_PATH ' + JSON.stringify({ ...result, roots: undefined, visible: undefined })); return;
  }
  errors.push('The drag never left the Z stack');
}

async function capture(arm: Arm, name: string, shots = true) {
  if (arm === 'align') { await alignmentReport(ORIGIN); return; }
  if (arm === 'datasets') { await datasetChecks(); return; }
  const directory = L37_DIR + name + '/'; await mkdir(directory, { recursive: true });
  const views = (await siteViewLinks(ORIGIN)).map(v => ({ id: v.id, url: v.url + '&embed' }));
  if (dotted(arm)) {
    for (const [id, v] of Object.entries(OWNER_VIEWS)) views.push({ id, url: ORIGIN + '/lmc/?v=' + v + '&embed' });
    for (const tilt of [30, 40, 50, 55, 60, 65, 70, 75, 80, 85]) views.push({ id: 'path-' + tilt, url: await cameraUrl(ORIGIN, pilotCamera('path-' + tilt, 128, [0, 0, 0], 10, tilt, 15)) });
  }
  views.push({ id: 'dor30-close', url: await cameraUrl(ORIGIN, pilotCamera('dor30-close', 128, [.53, -.72, -.05], 1.6, 45, 0)) });
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }), rows = [], errors: string[] = [], measures: Record<string, unknown>[] = [], cameras: unknown[] = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
    for (const view of views) {
      await page.goto(view.url, { waitUntil: 'domcontentloaded', timeout: 180000 });
      await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', {}, { timeout: 180000 });
      const layers = arm === 'sprites' ? 69 : 33;
      await page.waitForFunction(n => document.querySelectorAll('[data-volume-dataset-object="lmc-volume"] .css-volume-detail s').length === n, layers, { timeout: 120000 });
      if (arm === 'dots' || dotted(arm)) await page.waitForFunction(() => document.querySelectorAll('.prepared-cloud-points > div').length > 0, {}, { timeout: 60000 });
      const state = await page.evaluate(async (decode: boolean) => {
        const bank = document.querySelector<HTMLElement>('[data-volume-dataset-object="lmc-volume"]')!, detail = bank.querySelector<HTMLElement>('.css-volume-detail')!;
        const boards = [...bank.querySelectorAll<HTMLElement>('.prepared-cloud-points > div')];
        const urls = [...detail.querySelectorAll<HTMLElement>('s'), ...boards.slice(0, 1)].flatMap(n => [...getComputedStyle(n).backgroundImage.matchAll(/url\("?([^"\)]+)"?\)/gu)].map(m => m[1]!));
        if (decode) await Promise.all([...new Set(urls)].map(async url => { const image = new Image(); image.src = url; await image.decode(); }));
        await new Promise(r => setTimeout(r, 900));
        const rects = boards.map(n => { const b = n.getBoundingClientRect(), [x, y] = getComputedStyle(n).backgroundPosition.split(' ').map(parseFloat); return { cell: [-x!, -y!], box: [b.left, b.top, b.right, b.bottom], opacity: Number(getComputedStyle(n).opacity) }; });
        return { layers: detail.querySelectorAll('s').length, front: document.querySelectorAll('.prepared-cloud-points:not(.prepared-cloud-points-behind) > div').length, behind: document.querySelectorAll('.prepared-cloud-points-behind > div').length, overlayOpacity: getComputedStyle(bank.querySelector('.prepared-cloud-points') ?? bank).opacity, retained: bank.querySelectorAll('*').length, residentNodes: bank.dataset.volumeResidentDomNodes, images: new Set(urls).size, rects, axes: [...detail.querySelectorAll<HTMLElement>('.css-volume-projection')].slice(0, 3).map(n => Number(getComputedStyle(n).opacity)), far: [...bank.querySelectorAll<HTMLElement>('.css-volume-impostors')].map(n => getComputedStyle(n).display), detailOpacity: getComputedStyle(detail).opacity };
      }, shots);
      if (arm === 'all' && ['earth', 'pz', 'tilt45', 'py', 'dor30-close'].includes(view.id)) { const urls = await page.evaluate(() => [...new Set([...document.querySelectorAll<HTMLElement>('[data-volume-dataset-object="lmc-volume"] s, .prepared-cloud-points > div')].flatMap(n => [...getComputedStyle(n).backgroundImage.matchAll(/url\("?([^"\)]+)"?\)/gu)].map(m => m[1]!)))]); await page.evaluate(async list => { await Promise.all(list.map(async url => { const i = new Image(); i.src = url; await i.decode(); })); await new Promise(r => setTimeout(r, 500)); }, urls); const withGas = await page.screenshot(); const gasCount = (JSON.parse(await readFile(ALL_DIR + 'result.json', 'utf8')) as { groupIds: string[] }).groupIds.length, cross = (Math.ceil(Math.sqrt(state.rects.length))); await page.evaluate(([gas, side]) => { for (const n of document.querySelectorAll<HTMLElement>('.prepared-cloud-points > div')) { const [x, y] = getComputedStyle(n).backgroundPosition.split(' ').map(parseFloat); if (-y! / 128 * side! + -x! / 128 < gas!) n.style.display = 'none'; } }, [gasCount, cross]); await new Promise(r => setTimeout(r, 200)); const dustOnly = await page.screenshot(); await page.evaluate(() => { for (const n of document.querySelectorAll<HTMLElement>('.prepared-cloud-points > div')) n.style.display = ''; }); const hide = await page.addStyleTag({ content: '.prepared-cloud-points{display:none!important}' }); await new Promise(r => setTimeout(r, 200)); const without = await page.screenshot(); await hide.evaluate(n => (n as unknown as Element).remove()); measures.push(await measureLight(view.id, withGas, dustOnly, without, state.rects)); const v = await page.evaluate(() => { const api: unknown = Reflect.get(window, '__lmc'), runtime: unknown = api && Reflect.get(api as object, 'runtime'), read: unknown = runtime && Reflect.get(runtime as object, 'view'), value: unknown = typeof read === 'function' ? read.call(runtime) : null; return value ? { world: Reflect.get(value as object, 'worldCamera'), viewport: Reflect.get(value as object, 'stageViewport') } : null; }); cameras.push({ id: view.id, camera: v, rects: state.rects.map(r => ({ cell: r.cell, box: r.box })) }); }
      if (shots) await page.screenshot({ path: directory + view.id + '.png' });
      if (shots && arm === 'dots') { await page.addStyleTag({ content: '.prepared-cloud-points{display:none!important}' }); await new Promise(r => setTimeout(r, 200)); await page.screenshot({ path: directory + view.id + '-background.png' }); }
      rows.push({ ...view, ...state }); console.log('GAS_SITE_VIEW ' + JSON.stringify({ arm, id: view.id, layers: state.layers, front: state.front, behind: state.behind, retained: state.retained, detail: state.detailOpacity, far: state.far, axes: state.axes, errors: errors.length }));
    }
    if (dotted(arm)) { if (!process.argv.includes('--fast')) { await dragPath(page, errors); await zoomPath(page, errors); await backingReport(page, ORIGIN, errors); } await entryPoses(page, errors); await edgeHold(page, errors); if (graded(arm)) await imageLight(page, arm); }
  } finally { await browser.close(); }
  if (dotted(arm)) { await writeFile(ALL_DIR + 'light.json', JSON.stringify(measures) + '\n'); await writeFile(ALL_DIR + 'site-cameras.json', JSON.stringify(cameras) + '\n'); }
  await writeFile(directory + (arm === 'dots' || dotted(arm) ? 'site-result.json' : 'result.json'), JSON.stringify({ arm, complete: errors.length === 0, errors, rows }, null, 2) + '\n');
  console.log('GAS_SITE_ARM ' + arm + ' errors=' + errors.length + ' ' + errors.slice(0, 4).join(' | '));
}

export async function runArm(arm: Arm, name: string, stay: boolean) {
  await rm(STOP_FILE, { force: true }); await mkdir(L37_DIR, { recursive: true });
  await withPreviewLease(L37_DIR + 'preview.lease', async () => {
    await restoreAccepted(); await prepareCatalog();
    const bank = await readVolumeDatasetBank(prepared), native = bank.datasets[0]!.volume, { volume, copies } = await armVolume(arm, native);
    await mkdir(original, { recursive: true });
    for (const [from, to] of [[object + 'inventory.json', 'inventory.json'], [object + 'object.json', 'object.json'], [CONTEXT, 'context.json']] as const) await writeFile(original + to, await readFile(from));
    await rm(stage, { recursive: true, force: true }); await cp(prepared, stage, { recursive: true });
    for (const [from, to] of copies) { await mkdir(dirname(stage + '/' + to), { recursive: true }); await writeFile(stage + '/' + to, await readFile(from)); }
    if (dotted(arm)) { const path = stage + '/backing.json'; await writeFile(path, JSON.stringify(discBacking(JSON.parse(await readFile(path, 'utf8')) as BackingRecord)) + '\n'); }
    const presented = JSON.parse(await readFile(object + 'source/presentation.json', 'utf8')) as { datasets: PresentationRecord[] }, manifest = JSON.parse(await readFile(object + 'source/manifest.json', 'utf8')) as { inputs: { id: string; sourceUrl?: string }[] }, records = presented.datasets.map(r => ({ ...r, sourceUrl: manifest.inputs.find(i => i.id === r.input)?.sourceUrl ?? '' }));
    const own = records[0]!, first = { ...bank.datasets[0]!, volume, stars: { ...bank.datasets[0]!.stars, frame: volume.frame } }, extra = arm === 'datasets' ? await gradedDatasets(first, stage, records) : [];
    await writeVolumeDatasetBank(stage, { ...bank, datasets: [arm === 'datasets' ? { ...first, label: own.label, title: own.title, description: own.description } : first, ...extra] });
    let server: ReturnType<typeof spawn> | undefined;
    try {
      await rename(prepared, backup); await rename(stage, prepared);
      if (arm === 'datasets') prepareHost(); await inventoryPreparedAssets({ objectId: 'lmc-volume', objectDirectory: object }); await prepareCatalog();
      let occupied = false; try { occupied = (await fetch(ORIGIN)).ok; } catch {} need(!occupied, 'The pilot port is already occupied');
      server = spawn('pnpm', ['exec', 'astro', 'dev', '--config', 'site/astro.config.mts', '--host', '127.0.0.1', '--port', '4313', '--ignore-lock'], { detached: true, stdio: ['ignore', openSync(L37_DIR + 'server.log', 'w'), openSync(L37_DIR + 'server.log', 'a')], env: { ...process.env, ASTRO_DEV_BACKGROUND: '1' } });
      const deadline = Date.now() + 180000;
      while (true) { need(server.exitCode === null, 'The candidate site exited'); try { if ((await fetch(ORIGIN + '/lmc/')).ok) break; } catch {} need(Date.now() < deadline, 'The candidate site did not start'); await new Promise(r => setTimeout(r, 500)); }
      await capture(arm, name, !process.argv.includes('--state-only'));
      if (stay) {
        console.log('GAS_LIVE ' + ORIGIN + '/lmc/');
        await new Promise<void>(resolve => { const finish = () => { clearInterval(timer); resolve(); }; process.once('SIGTERM', finish); process.once('SIGINT', finish); const timer = setInterval(() => { void exists(STOP_FILE).then(found => { if (found) finish(); }); }, 3000); });
      }
    } finally {
      if (server?.pid) { try { process.kill(-server.pid, 'SIGTERM'); } catch {} await new Promise(r => setTimeout(r, 800)); }
      await restoreAccepted();
    }
  });
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const arm = process.argv[2]; need(arm === 'accepted' || arm === 'dots' || arm === 'sprites' || arm === 'all' || arm === 'gasfree' || arm === 'align' || arm === 'decam' || arm === 'vista' || arm === 'datasets', 'Choose an arm');
  await runArm(arm, process.argv[3] ?? arm, process.argv.includes('--stay'));
}
