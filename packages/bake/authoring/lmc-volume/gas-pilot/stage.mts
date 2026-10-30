/** One arm in the real site: a data-only swap of the installed bank, with the accepted bank restored byte for byte afterwards. */
import { access, cp, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
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
import { L37_DIR, PILOT_REGIONS } from './regions.mts';
import { SPRITES_DIR } from './sprites.mts';

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

type Arm = 'accepted' | 'dots' | 'sprites';
async function armVolume(arm: Arm, native: PreparedCssVolume): Promise<{ volume: PreparedCssVolume; copies: [string, string][] }> {
  if (arm === 'accepted') return { volume: native, copies: [] };
  const copies: [string, string][] = [];
  const resources = await Promise.all(native.resources.map(async r => { if (!r.path.startsWith('l36-near/')) return r; const from = BACKGROUND_DIR + 'bank/' + r.path.slice('l36-near/'.length); copies.push([from, r.path]); return { ...r, bytes: (await stat(from)).size }; }));
  const background = validatePreparedCssVolume({ ...native, resources });
  if (arm === 'dots') { for (const name of ['gas-dots.bin', 'gas-dots-atlas.webp']) copies.push([DOTS_DIR + name, name]); return { volume: validatePreparedCssVolume({ ...background, pointOverlays: ['gas-dots.bin'] }), copies }; }
  const parts = await Promise.all(PILOT_REGIONS.map(async r => ({ id: r.id, volume: validatePreparedCssVolume(await json(SPRITES_DIR + r.id + '/volume.json')) })));
  for (const part of parts) for (const res of part.volume.resources) copies.push([SPRITES_DIR + part.id + '/' + res.path.slice(res.path.indexOf('/') + 1), res.path]);
  return { volume: composeFiniteComponents(background, parts), copies };
}

async function capture(arm: Arm, name: string, shots = true) {
  const directory = L37_DIR + name + '/'; await mkdir(directory, { recursive: true });
  const views = (await siteViewLinks(ORIGIN)).map(v => ({ id: v.id, url: v.url + '&embed' }));
  views.push({ id: 'dor30-close', url: await cameraUrl(ORIGIN, pilotCamera('dor30-close', 128, [.53, -.72, -.05], 1.6, 45, 0)) });
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }), rows = [], errors: string[] = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
    for (const view of views) {
      await page.goto(view.url, { waitUntil: 'domcontentloaded', timeout: 180000 });
      await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', {}, { timeout: 180000 });
      const layers = arm === 'sprites' ? 69 : 33;
      await page.waitForFunction(n => document.querySelectorAll('[data-volume-dataset-object="lmc-volume"] .css-volume-detail s').length === n, layers, { timeout: 120000 });
      if (arm === 'dots') await page.waitForFunction(() => document.querySelectorAll('.prepared-cloud-points > div').length > 0, {}, { timeout: 60000 });
      const state = await page.evaluate(async (decode: boolean) => {
        const bank = document.querySelector<HTMLElement>('[data-volume-dataset-object="lmc-volume"]')!, detail = bank.querySelector<HTMLElement>('.css-volume-detail')!;
        const boards = [...bank.querySelectorAll<HTMLElement>('.prepared-cloud-points > div')];
        const urls = [...detail.querySelectorAll<HTMLElement>('s'), ...boards.slice(0, 1)].flatMap(n => [...getComputedStyle(n).backgroundImage.matchAll(/url\("?([^"\)]+)"?\)/gu)].map(m => m[1]!));
        if (decode) await Promise.all([...new Set(urls)].map(async url => { const image = new Image(); image.src = url; await image.decode(); }));
        await new Promise(r => setTimeout(r, 900));
        const rects = boards.map(n => { const b = n.getBoundingClientRect(), [x, y] = getComputedStyle(n).backgroundPosition.split(' ').map(parseFloat); return { cell: [-x!, -y!], box: [b.left, b.top, b.right, b.bottom], opacity: Number(getComputedStyle(n).opacity) }; });
        return { layers: detail.querySelectorAll('s').length, front: document.querySelectorAll('.prepared-cloud-points:not(.prepared-cloud-points-behind) > div').length, behind: document.querySelectorAll('.prepared-cloud-points-behind > div').length, overlayOpacity: getComputedStyle(bank.querySelector('.prepared-cloud-points') ?? bank).opacity, retained: bank.querySelectorAll('*').length, residentNodes: bank.dataset.volumeResidentDomNodes, images: new Set(urls).size, rects, axes: [...detail.querySelectorAll<HTMLElement>('.css-volume-projection')].slice(0, 3).map(n => Number(getComputedStyle(n).opacity)), far: [...bank.querySelectorAll<HTMLElement>('.css-volume-impostors')].map(n => getComputedStyle(n).display), detailOpacity: getComputedStyle(detail).opacity };
      }, shots);
      if (shots) await page.screenshot({ path: directory + view.id + '.png' });
      if (shots && arm === 'dots') { await page.addStyleTag({ content: '.prepared-cloud-points{display:none!important}' }); await new Promise(r => setTimeout(r, 200)); await page.screenshot({ path: directory + view.id + '-background.png' }); }
      rows.push({ ...view, ...state }); console.log('GAS_SITE_VIEW ' + JSON.stringify({ arm, id: view.id, layers: state.layers, front: state.front, behind: state.behind, retained: state.retained, detail: state.detailOpacity, far: state.far, axes: state.axes, errors: errors.length }));
    }
  } finally { await browser.close(); }
  await writeFile(directory + (arm === 'dots' ? 'site-result.json' : 'result.json'), JSON.stringify({ arm, complete: errors.length === 0, errors, rows }, null, 2) + '\n');
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
  const arm = process.argv[2]; need(arm === 'accepted' || arm === 'dots' || arm === 'sprites', 'Choose an arm');
  await runArm(arm, process.argv[3] ?? arm, process.argv.includes('--stay'));
}
