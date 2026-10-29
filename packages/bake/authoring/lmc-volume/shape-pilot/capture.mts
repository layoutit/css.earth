/** A finite cloud or shell is inspected in the real site, at its exact physical camera. */
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { validatePreparedCssVolume } from '@cssearth/objects';
import { cameraPoseFromReferenceFrame } from '@cssearth/engine';
import { parseEmbedPageMessage, EMBED_BRIDGE_PROTOCOL } from '@cssearth/renderer/embed/embed-bridge.ts';
import { cameraUrl, cameraWorld, regionCameras } from '../piece-pilot/cameras.mts';
import { KPC_M } from '../delivery/delivery-frame.mts';
import { json, need } from '../inputs.mts';
import { readShapeSource, SHAPE_DIR } from './source.mts';
import { withTemporaryBank } from './temporary-bank.mts';

export async function captureShape(id: string, oneView = false, interrupt = false) {
  const source = await readShapeSource(), shape = source.shapes.find(s => s.id === id); need(shape, 'Unknown finite shape');
  const volume = validatePreparedCssVolume(await json(SHAPE_DIR + id + '-volume.json')), count = volume.stacks.reduce((n, s) => n + s.leaves.length, 0), directory = SHAPE_DIR + id + '/site/';
  await mkdir(directory, { recursive: true });
  await withTemporaryBank(volume, async origin => {
    const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }), rows = [];
    try {
      const page = await browser.newPage({ viewport: { width: 512, height: 784 }, deviceScaleFactor: 1 }), errors: string[] = [];
      page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      const cameras = regionCameras(id, shape.box);
      for (const c of oneView ? cameras.slice(0, 1) : cameras) {
        const url = await cameraUrl(origin, c); await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', {}, { timeout: 120000 });
        await page.waitForFunction(() => { const bank = document.querySelector<HTMLElement>('[data-volume-dataset-object="lmc-volume"]'), n = bank?.querySelector<HTMLElement>('.css-volume-detail') ?? bank; return n && n.querySelector('.css-volume-projection') && getComputedStyle(n).display !== 'none' && Number(getComputedStyle(n).opacity) > .9; }, {}, { timeout: 30000 });
        need(errors.length === 0, 'The actual site reported: ' + errors.join('; '));
        const state = await page.evaluate(async () => {
          const bank = document.querySelector<HTMLElement>('[data-volume-dataset-object="lmc-volume"]')!, detail = bank.querySelector<HTMLElement>('.css-volume-detail') ?? bank;
          detail.style.background = '#000';
          const urls = [...detail.querySelectorAll<HTMLElement>('s')].flatMap(n => [...getComputedStyle(n).backgroundImage.matchAll(/url\("?([^"\)]+)"?\)/gu)].map(m => m[1]!));
          await Promise.all([...new Set(urls)].map(async url => { const image = new Image(); image.src = url; await image.decode(); }));
          await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
          const api: unknown = Reflect.get(window, '__lmc'); if (!api || typeof api !== 'object') throw Error('Missing app diagnostics');
          const runtime: unknown = Reflect.get(api, 'runtime'); if (!runtime || typeof runtime !== 'object') throw Error('Missing app runtime');
          const read: unknown = Reflect.get(runtime, 'view'); if (typeof read !== 'function') throw Error('Missing physical camera');
          const v: unknown = read.call(runtime); if (!v || typeof v !== 'object') throw Error('Missing physical view');
          return { world: Reflect.get(v, 'worldCamera'), viewport: Reflect.get(v, 'stageViewport'), layers: detail.querySelectorAll('s').length, axes: [...detail.querySelectorAll<HTMLElement>('.css-volume-projection')].map(n => ({ opacity: Number(getComputedStyle(n).opacity), background: getComputedStyle(n).backgroundColor })), far: [...bank.querySelectorAll<HTMLElement>('.css-volume-impostors')].map(n => getComputedStyle(n).display) };
        });
        const actual = parseEmbedPageMessage({ protocol: EMBED_BRIDGE_PROTOCOL, type: 'camera', camera: { world: state.world, viewport: state.viewport }, moving: false }); need(actual?.type === 'camera', 'Invalid published camera');
        const expected = cameraWorld(c), delta = cameraPoseFromReferenceFrame(actual.camera.world.pose, { originM: expected.pose.positionM, localToReferenceXyzw: expected.pose.orientationXyzw });
        need(Math.hypot(...delta.positionM) / KPC_M < 1e-6 && Math.abs(delta.orientationXyzw[3]) > 1 - 1e-8, 'The app moved the source camera');
        need(state.layers === count && state.far.every(v => v === 'none'), 'The app must draw the finite XYZ geometry, not a far picture');
        if (c.name.endsWith('-45-0')) need(state.axes.filter(a => a.opacity > .01).length >= 2, 'An independent shape must not inherit the thin-disc top-stack selector');
        const optics = actual.camera.viewport; need(typeof optics.widthPixels === 'number' && typeof optics.heightPixels === 'number' && Math.abs(optics.focalPixels / (4 * c.focal) - 1) < 1e-4, 'Physical camera scale differs');
        const stage = await page.locator('.object-viewport').boundingBox(); need(stage, 'Missing real scene viewport');
        const clip = { x: stage.x + optics.widthPixels / 2 + optics.principalOffsetPixels[0] - 256, y: stage.y + optics.heightPixels / 2 + optics.principalOffsetPixels[1] - 256, width: 512, height: 512 };
        need(clip.x >= stage.x && clip.y >= stage.y && clip.x + 512 <= stage.x + stage.width && clip.y + 512 <= stage.y + stage.height, 'Capture lies outside the real scene');
        const image = await page.screenshot({ path: directory + c.name + '.png', clip }); await sharp(image).resize(128, 128).png().toFile(directory + c.name + '-128.png');
        rows.push({ name: c.name, url, state, pixelPc: c.widthKpc / 128 * 1000 }); console.log('FINITE_SITE_IMAGE ' + c.name);
      }
    } finally { await browser.close(); }
    await writeFile(directory + 'result.json', JSON.stringify({ complete: true, componentOnly: true, oneView, actualSite: true, rows }, null, 2) + '\n');
  }, interrupt, true);
  console.log('FINITE_SHAPE_SITE_COMPLETE ' + id);
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await captureShape(process.argv[2] ?? 'cloud', process.argv.includes('--one'), process.argv.includes('--interrupt'));
