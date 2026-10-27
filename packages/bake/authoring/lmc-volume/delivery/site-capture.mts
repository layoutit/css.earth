/** Capture actual X/Y/Z layers in the real app, plus its unresolved-picture handoff. */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { chromium, type Page } from 'playwright';
import sharp from 'sharp';
import { parseEmbedPageMessage, EMBED_BRIDGE_PROTOCOL } from '@cssearth/renderer/embed/embed-bridge.ts';
import { parseSharedView, formatSharedView } from '@cssearth/renderer/navigation';
import { cameraPoseFromReferenceFrame, presentPhysicalPoseInVolume } from '@cssearth/engine';
import { SITE_DIR, siteViewLinks, VIEW_WIDTH_KPC } from './site-views.mts';
import { sitePhoto } from './site-photo.mts';
import { deliveryPhysicalFrame, KPC_M } from './delivery-frame.mts';
import { need } from '../inputs.mts';

async function waitForPresentation(page: Page, layered: boolean) {
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', {}, { timeout: 120000 });
  await page.waitForSelector('[data-volume-dataset-object="lmc-volume"]', { state: 'attached', timeout: 120000 });
  await page.waitForFunction(wantLayers => {
    const bank = document.querySelector<HTMLElement>('[data-volume-dataset-object="lmc-volume"]');
    if (!bank || getComputedStyle(bank).display === 'none' || Number(getComputedStyle(bank).opacity) < .9) return false;
    const node = bank.querySelector<HTMLElement>(wantLayers ? '.css-volume-detail' : '.css-volume-impostors');
    return node !== null && getComputedStyle(node).display !== 'none' && Number(getComputedStyle(node).opacity) > .9;
  }, layered, { timeout: 120000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    const urls = new Set([...document.querySelectorAll<HTMLElement>('[data-volume-dataset-object="lmc-volume"] s')]
      .flatMap(n => [...getComputedStyle(n).backgroundImage.matchAll(/url\("?([^"\)]+)"?\)/gu)].map(m => m[1]!)));
    await Promise.all([...urls].map(async url => { const image = new Image(); image.src = url; await image.decode(); }));
    await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  });
}

async function readPhysicalCamera(page: Page) {
  const optics = await page.evaluate(() => {
    const api: unknown = Reflect.get(window, '__lmc');
    if (!api || typeof api !== 'object') throw Error('Missing real object diagnostics');
    const runtime: unknown = Reflect.get(api, 'runtime');
    if (!runtime || typeof runtime !== 'object') throw Error('Missing runtime diagnostics');
    const read: unknown = Reflect.get(runtime, 'view');
    if (typeof read !== 'function') throw Error('Missing published view');
    const published: unknown = read.call(runtime);
    if (!published || typeof published !== 'object') throw Error('No published camera');
    return { world: Reflect.get(published, 'worldCamera'), viewport: Reflect.get(published, 'stageViewport') };
  });
  const actual = parseEmbedPageMessage({ protocol: EMBED_BRIDGE_PROTOCOL, type: 'camera',
    camera: { world: optics.world, viewport: optics.viewport }, moving: false });
  need(actual?.type === 'camera', 'The real site did not expose a valid published physical camera');
  return actual.camera;
}

async function readLayers(page: Page) {
  return page.evaluate(() => ({
    ready: document.documentElement.dataset.ready,
    host: [...document.querySelectorAll<HTMLElement>('[data-volume-dataset-object="lmc-volume"]')].map(n => ({ display: getComputedStyle(n).display, opacity: getComputedStyle(n).opacity })),
    detail: [...document.querySelectorAll<HTMLElement>('[data-volume-dataset-object="lmc-volume"] .css-volume-detail')].map(n => ({
      display: getComputedStyle(n).display, opacity: getComputedStyle(n).opacity, leaves: n.querySelectorAll('s').length,
      stacks: [...n.querySelectorAll<HTMLElement>('.css-volume-projection')].map((s, axis) => ({
        axis: ['x', 'y', 'z'][axis], display: getComputedStyle(s).display, opacity: getComputedStyle(s).opacity,
        layers: s.querySelectorAll('s').length,
        distinctTransforms: new Set([...s.querySelectorAll<HTMLElement>('s')].map(l => l.style.transform)).size,
      })),
    })),
    far: [...document.querySelectorAll<HTMLElement>('[data-volume-dataset-object="lmc-volume"] .css-volume-impostors')].map(n => ({
      display: getComputedStyle(n).display, opacity: getComputedStyle(n).opacity,
      views: [...n.querySelectorAll<HTMLElement>('s')].filter(v => getComputedStyle(v).display !== 'none').map(v => v.dataset.volumeImpostor),
    })),
  }));
}

export async function captureSite(origin: string) {
  const views = await siteViewLinks(origin);
  let pins: Awaited<ReturnType<typeof sitePhoto>> = [];
  await mkdir(SITE_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const rows = [];
  let unresolvedContext;
  try {
    const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    for (const view of views) {
      const start = performance.now(), captureUrl = view.url + '&embed';
      await page.goto(captureUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
      console.log('LMC_SITE_DOCUMENT ' + view.id);
      await waitForPresentation(page, true);
      const actual = await readPhysicalCamera(page);
      const delta = cameraPoseFromReferenceFrame(actual.world.pose, {
        originM: view.world.pose.positionM, localToReferenceXyzw: view.world.pose.orientationXyzw,
      });
      need(Math.hypot(...delta.positionM) / KPC_M < 1e-6 && Math.abs(delta.orientationXyzw[3]) > 1 - 1e-8, 'The real site moved the saved physical observer');
      const local = presentPhysicalPoseInVolume(actual.world.pose, { ...deliveryPhysicalFrame(), metersPerUnit: KPC_M,
        boundsUnits: { min: [-10, -10, -2.1], max: [10, 10, 2.1] } });
      const widthKpc = 1024 * Math.hypot(...local.positionUnits) / actual.viewport.focalPixels;
      need(Math.abs(widthKpc / VIEW_WIDTH_KPC - 1) < 1e-4, 'The real site changed the requested physical scale');
      if (view.id === 'earth') pins = await sitePhoto({ focal: actual.viewport.focalPixels,
        principalOffsetPixels: [actual.viewport.principalOffsetPixels[0], actual.viewport.principalOffsetPixels[1]] });
      const state = await readLayers(page), detail = state.detail[0];
      need(state.ready === 'true' && detail?.display !== 'none' && detail?.leaves === 33, 'Every resolved view, including Earth, must draw 33 slab layers');
      need(detail.stacks.length === 3 && detail.stacks.every((s, i) => s.axis === ['x', 'y', 'z'][i]
        && s.layers === [12, 11, 10][i] && s.distinctTransforms === [10, 9, 7][i]), 'The real site must retain distinct spatial X/Y/Z slabs');
      need(state.far.every(n => n.display === 'none'), 'A billboard must not contribute to the resolved galaxy');
      await page.screenshot({ path: SITE_DIR + view.id + '.png' });
      rows.push({ id: view.id, url: view.url, captureUrl, state, optics: {
        focalPixels: actual.viewport.focalPixels, principalOffsetPixels: actual.viewport.principalOffsetPixels,
        physicalWidthKpc: widthKpc, world: actual.world,
      }, loadSeconds: (performance.now() - start) / 1000 });
      console.log('LMC_SITE_VIEW_CAPTURED ' + view.id + ' XYZ 33');
    }
    const saved = parseSharedView(new URL(views[0]!.url).search);
    need(saved, 'The Earth view must use the shared camera URL');
    const contextUrl = origin + '/lmc/?' + formatSharedView({ ...saved,
      camera: { ...saved.camera, projectionScale: (saved.camera.projectionScale ?? 1) * .025 } }) + '&embed';
    await page.goto(contextUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', {}, { timeout: 120000 });
    await page.waitForSelector('[data-volume-dataset-object="lmc-volume"]', { state: 'attached', timeout: 120000 });
    await page.waitForFunction(() => {
      const bank = document.querySelector<HTMLElement>('[data-volume-dataset-object="lmc-volume"]');
      if (!bank) return false;
      if (getComputedStyle(bank).display === 'none') return true;
      const detail = bank.querySelector<HTMLElement>('.css-volume-detail');
      const picture = bank.querySelector<HTMLElement>('.css-volume-impostors');
      return detail !== null && getComputedStyle(detail).display === 'none'
        && picture !== null && getComputedStyle(picture).display !== 'none';
    }, {}, { timeout: 120000 });
    const contextCamera = await readPhysicalCamera(page), contextState = await readLayers(page);
    const delta = cameraPoseFromReferenceFrame(contextCamera.world.pose, {
      originM: views[0]!.world.pose.positionM, localToReferenceXyzw: views[0]!.world.pose.orientationXyzw,
    });
    need(Math.hypot(...delta.positionM) / KPC_M < 1e-6 && Math.abs(delta.orientationXyzw[3]) > 1 - 1e-8,
      'Changing magnification must preserve the physical Earth observer');
    need(contextState.detail.every(d => d.display === 'none' && d.leaves === 0)
      && (contextState.host.every(h => h.display === 'none') || contextState.far.some(f => f.display !== 'none')),
      'The unresolved context must retire the slab bank, either to its picture or to the shared world backing');
    unresolvedContext = { url: contextUrl, samePhysicalObserver: true, projectionScaleRatio: .025, state: contextState };
    await page.screenshot({ path: SITE_DIR + 'unresolved-context.png' });
    need(errors.length === 0, 'Real-site errors: ' + errors.join('; '));
  } finally { await browser.close(); }

  const images = [SITE_DIR + 'earth.png', SITE_DIR + 'horalek-world.png', SITE_DIR + 'pz.png', SITE_DIR + 'tilt45.png', SITE_DIR + 'py.png'];
  const panels = await Promise.all(images.map(path => sharp(path).resize(768, 576).png().toBuffer()));
  const title = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2304" height="1232"><rect width="100%" height="100%" fill="#101216"/><g fill="white" font-family="Arial" font-size="24"><text x="12" y="30">Real site: Earth, X/Y/Z slabs</text><text x="780" y="30">Horálek: measured sky registration</text><text x="1548" y="30">Face-on: X/Y/Z slabs</text><text x="12" y="646">45 degrees: X/Y/Z slabs</text><text x="780" y="646">Edge-on: X/Y/Z slabs</text><text x="1548" y="646">All views: 9.47 kpc across at 1024 px</text></g></svg>');
  await sharp(title).composite(panels.map((input, i) => ({ input, left: i % 3 * 768, top: Math.floor(i / 3) * 616 + 40 }))).png().toFile(SITE_DIR + 'sheet.png');
  for (const pin of pins) {
    const left = Math.round(pin.siteX) - 30, top = Math.round(pin.siteY) - 30;
    if (left < 0 || top < 0 || left + 61 > 1024 || top + 61 > 768) continue;
    const crops = await Promise.all(['horalek-world', 'earth'].map(id => sharp(SITE_DIR + id + '.png')
      .extract({ left, top, width: 61, height: 61 }).resize(305, 305, { kernel: 'nearest' }).png().toBuffer()));
    await sharp({ create: { width: 610, height: 305, channels: 3, background: '#000' } })
      .composite(crops.map((input, i) => ({ input, left: i * 305, top: 0 }))).png().toFile(SITE_DIR + 'pin-' + pin.id + '.png');
  }
  await writeFile(SITE_DIR + 'result.json', JSON.stringify({ complete: true, realSite: true,
    viewport: { width: 1024, height: 768, dpr: 1 }, physicalWidthKpc: VIEW_WIDTH_KPC, pcPerPixel: VIEW_WIDTH_KPC / 1024 * 1000,
    views: rows, unresolvedContext, pinCropWidth: 61,
    comparison: 'Horálek is reprojected using its recorded astrometric registration. The physical camera remains right-handed. The photograph includes its display sky; galaxy textures do not bake that background into the model.',
  }, null, 2) + '\n');
  need((await readFile(SITE_DIR + 'sheet.png')).length > 100000, 'The site sheet is empty');
  console.log('LMC_REAL_SITE_CAPTURE_COMPLETE XYZ');
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await captureSite(process.argv[2] ?? 'http://127.0.0.1:4312');
