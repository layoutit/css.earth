/** One arm in the real site: a data-only swap of the installed bank, with the accepted bank restored byte for byte afterwards. */
import { access, cp, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { validatePreparedCssVolume, type PreparedCssVolume } from '@cssearth/objects';
import { inventoryPreparedAssets, readVolumeDatasetBank, writeVolumeDatasetBank } from '@cssearth/objects/node';
import { prepareCatalog } from '../../../../../site/build/prepare/catalog/prepare-catalog.mts';
import { siteViewLinks } from '../delivery/site-views.mts';
import { cameraUrl, pilotCamera } from '../piece-pilot/cameras.mts';
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

const OWNER_VIEWS = { A: 'UYNDKid65ZoPsMM7jkKo0rK7w8M2LdAC0JFBQsczQAAAAEAYLePdTsc_v-SEPg9eQck_xhiBrVRtdb-y9jlCd__kAAA', B: 'UYNDKid65ZoPsMM7jkKo0rK7w8M2LdAC0JFBQsczQAAAAEAYLePdTsc_v-SKn2nq6Q0_tAI9Dr8Hnz95Xl0j650cAAA', C: 'UYNDKid65ZoPsMM7jkKo0rK7w8M2LdAC0JFBQsczQAAAAEAYLePdTsc_v-QgFFSGD4y_eediPfXx6D-zirDngHj0AAA' };
export const STOP_FILE = L37_DIR + 'stop-live', ORIGIN = 'http://127.0.0.1:4313';
const object = 'src/objects/lmc-volume/', prepared = object + 'prepared', backup = L37_DIR + 'accepted-backup', stage = L37_DIR + 'site-stage', original = L37_DIR + 'original/';
const exists = (path: string) => access(path).then(() => true, () => false);
const CONTEXT = 'site/prepared/prepared-context-bank-assets.json';

export async function restoreAccepted() {
  if (!await exists(backup)) return;
  const inventory = await readFile(original + 'inventory.json'), context = await readFile(original + 'context.json'), descriptor = await readFile(original + 'object.json');
  await rm(prepared, { recursive: true, force: true }); await rename(backup, prepared); await writeFile(object + 'inventory.json', inventory); await writeFile(object + 'object.json', descriptor); await prepareCatalog();
  need((await readFile(object + 'inventory.json')).equals(inventory) && (await readFile(object + 'object.json')).equals(descriptor) && (await readFile(CONTEXT)).equals(context), 'The accepted bank did not restore exactly');
  console.log('GAS_ACCEPTED_BANK_RESTORED');
}

type Arm = 'accepted' | 'dots' | 'sprites' | 'all' | 'gasfree';
const HANDOVER = [.15, .65] as const;
async function armVolume(arm: Arm, native: PreparedCssVolume): Promise<{ volume: PreparedCssVolume; copies: [string, string][] }> {
  if (arm === 'accepted') return { volume: native, copies: [] };
  const copies: [string, string][] = [];
  const resources = await Promise.all(native.resources.map(async r => { if (!r.path.startsWith('l36-near/')) return r; const from = (arm === 'all' ? SMOOTH_BACKGROUND_DIR : arm === 'gasfree' ? ALL_BACKGROUND_DIR : BACKGROUND_DIR) + 'bank/' + r.path.slice('l36-near/'.length); copies.push([from, r.path]); return { ...r, bytes: (await stat(from)).size }; }));
  const background = validatePreparedCssVolume({ ...native, resources });
  if (arm === 'gasfree') return { volume: background, copies };
  if (arm === 'all') { for (const name of ['gas-dots.bin', 'gas-dots-atlas.webp']) copies.push([ALL_DIR + name, name]); return { volume: validatePreparedCssVolume({ ...background, pointOverlays: ['gas-dots.bin'], thinHandoverCosines: HANDOVER, stackCompositing: 'transparent-normalized' }), copies }; }
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

/** Both entries, by state: opening /lmc/ and clicking it from the Milky Way's page, and where the Milky Way's centre falls. */
async function entryPoses(page: import('playwright').Page, errors: string[]) {
  const read = () => page.evaluate(() => { for (const key of Object.keys(window)) if (key.startsWith('__')) { const api = Reflect.get(window, key) as { runtime?: { view?: () => { worldCamera: unknown; stageViewport: unknown } } } | null, view = api?.runtime?.view?.(); if (view) return { key, world: view.worldCamera, viewport: view.stageViewport, href: location.pathname }; } return null; }) as Promise<{ key: string; world: { pose: { positionM: [number, number, number]; orientationXyzw: [number, number, number, number]; focusOffset?: { offsetM: number[] } } }; viewport: { focalPixels: number; widthPixels: number; heightPixels: number }; href: string } | null>;
  const summary = (v: NonNullable<Awaited<ReturnType<typeof read>>>) => { const at = milkyWayOnScreen(v.world.pose.positionM, v.world.pose.orientationXyzw, v.viewport.focalPixels); return { href: v.href, orientation: v.world.pose.orientationXyzw.map(q => +q.toFixed(5)), distanceKpc: +(Math.hypot(...(v.world.pose.focusOffset?.offsetM ?? [0, 0, 0])) / 3.0856775814913673e19).toFixed(2), milkyWayPx: at && at.map(x => Math.round(x)), halfFrame: [v.viewport.widthPixels / 2, v.viewport.heightPixels / 2], inFrame: !!at && Math.abs(at[0]) < v.viewport.widthPixels / 2 && Math.abs(at[1]) < v.viewport.heightPixels / 2 }; };
  const ready = () => page.waitForFunction(() => document.documentElement.dataset.ready === 'true', {}, { timeout: 180000 });
  await page.goto(ORIGIN + '/lmc/', { waitUntil: 'domcontentloaded', timeout: 180000 }); await ready(); await page.waitForTimeout(2500); const direct = await read();
  await page.goto(ORIGIN + '/milky-way/', { waitUntil: 'domcontentloaded', timeout: 180000 }); await ready(); await page.waitForTimeout(1500);
  await page.evaluate(() => { const a = [...document.querySelectorAll<HTMLAnchorElement>('a[href]')].find(n => n.getAttribute('href') === '/lmc/'); if (!a) throw Error('No LMC link'); a.click(); });
  await page.waitForFunction(() => location.pathname.startsWith('/lmc'), {}, { timeout: 60000 }).catch(() => errors.push('Click did not reach /lmc/')); await page.waitForTimeout(9000); const clicked = await read();
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
  const directory = L37_DIR + name + '/'; await mkdir(directory, { recursive: true });
  const views = (await siteViewLinks(ORIGIN)).map(v => ({ id: v.id, url: v.url + '&embed' }));
  if (arm === 'all') {
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
      if (arm === 'dots' || arm === 'all') await page.waitForFunction(() => document.querySelectorAll('.prepared-cloud-points > div').length > 0, {}, { timeout: 60000 });
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
    if (arm === 'all') { await dragPath(page, errors); await entryPoses(page, errors); }
  } finally { await browser.close(); }
  if (arm === 'all') { await writeFile(ALL_DIR + 'light.json', JSON.stringify(measures) + '\n'); await writeFile(ALL_DIR + 'site-cameras.json', JSON.stringify(cameras) + '\n'); }
  await writeFile(directory + (arm === 'dots' || arm === 'all' ? 'site-result.json' : 'result.json'), JSON.stringify({ arm, complete: errors.length === 0, errors, rows }, null, 2) + '\n');
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
    await writeVolumeDatasetBank(stage, { ...bank, datasets: [{ ...bank.datasets[0]!, volume, stars: { ...bank.datasets[0]!.stars, frame: volume.frame } }] });
    let server: ReturnType<typeof spawn> | undefined;
    try {
      await rename(prepared, backup); await rename(stage, prepared);
      await inventoryPreparedAssets({ objectId: 'lmc-volume', objectDirectory: object }); await prepareCatalog();
      let occupied = false; try { occupied = (await fetch(ORIGIN)).ok; } catch {} need(!occupied, 'The pilot port is already occupied');
      server = spawn('pnpm', ['exec', 'astro', 'dev', '--config', 'site/astro.config.mts', '--host', '127.0.0.1', '--port', '4313', '--ignore-lock'], { detached: true, stdio: ['ignore', 'ignore', 'ignore'], env: { ...process.env, ASTRO_DEV_BACKGROUND: '1' } });
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
  const arm = process.argv[2]; need(arm === 'accepted' || arm === 'dots' || arm === 'sprites' || arm === 'all' || arm === 'gasfree', 'Choose an arm');
  await runArm(arm, process.argv[3] ?? arm, process.argv.includes('--stay'));
}
