import { sha256 } from '../../src/platform/sha256.mts';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, relative, extname, sep } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { Quaternion, Vector3, MathUtils } from 'three';
import { requireRecord, requireArray, requireString, requireFiniteNumber } from '../sources/source-values.mts';
import type { RenderRequest, renderFacility, recipe } from '../facility-renders/render.mts';
import { writePreparedSet } from '../prepared/write-prepared-set.mts';
import { prepareArtworkRefresh } from '../facility-renders/refresh.mts';
import { getFacilityPose, inwardDirection } from '../facility-renders/poses.mts';

declare global { interface Window { FacilityRender: { renderFacility: typeof renderFacility; recipe: typeof recipe }; } }

const root = resolve(import.meta.dirname, '../..');
const args = process.argv.slice(2), write = args.includes('--write');
const inspectAxes = args.includes('--inspect-axes');
const inspectRolls = args.includes('--inspect-rolls');
if ((inspectAxes || inspectRolls) && write) throw new Error('Pose review cannot publish artwork');
if (inspectAxes && inspectRolls) throw new Error('Choose source axes or inward-facing rolls');
const option = (name: string, fallback: string) => args.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const output = resolve(root, option('output', 'output/facility-lighting-preview'));
const cache = resolve(root, option('cache', relative(root, output)));
const only = option('only', '').split(',').filter(Boolean);
const libraryPath = resolve(root, 'site/source/facilities/render-library.json');
const libraryBefore = await readFile(libraryPath);
const library = requireRecord(JSON.parse(libraryBefore.toString('utf8')));
const entries = requireArray(library.entries).map(value => requireRecord(value));
const selected = entries.filter(entry => requireRecord(entry.source).kind === 'model-render' && (!only.length || only.includes(requireString(entry.id))));
if (!selected.length) throw new Error('No model-render entries selected');

const local = (base: string, path: string) => { const result = resolve(base, path); if (!result.startsWith(base + sep)) throw new Error('Unsafe asset path'); return result; };
await mkdir(resolve(output, 'rendered'), { recursive: true }); await mkdir(resolve(output, 'before'), { recursive: true });
const files = new Map<string, { path: string; url: string; bytes: number }>();
for (const entry of selected) {
  const source = requireRecord(entry.source), model = requireRecord(source.model);
  for (const value of [model, ...requireArray(source.dependencies ?? [])]) {
    const file = requireRecord(value), path = requireString(file.path);
    files.set(path, { path, url: requireString(file.url ?? source.url), bytes: requireFiniteNumber(file.bytes) });
  }
}
for (const file of files.values()) {
  const path = local(cache, file.path);
  let bytes: Buffer;
  try { bytes = await readFile(path); } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
    const response = await fetch(file.url); if (!response.ok) throw new Error(`Source download failed: ${file.url}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== file.bytes) throw new Error(`Source byte count mismatch: ${file.path} has ${bytes.length}, library declares ${file.bytes}`);
    await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes);
  }
  if (bytes.length !== file.bytes) throw new Error(`Source byte count mismatch: ${file.path} has ${bytes.length}, library declares ${file.bytes}`);
}
for (const file of files.values()) if (file.path.endsWith('.usdz')) {
  const source = local(cache, file.path), destination = local(cache, file.path.replace(/\.usdz$/, '.usda'));
  execFileSync('usdcat', [source, '--flatten', '--skipSourceFileComment', '-o', destination]);
  for (const image of ['0/image0.jpg', '0/image1.jpg', '0/image2.jpg']) {
    const destination = resolve(dirname(source), image); await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, execFileSync('unzip', ['-p', source, image]));
  }
}
const bundle = await build({ entryPoints: [resolve(root, 'tools/facility-renders/render.mts')], bundle: true, format: 'iife', globalName: 'FacilityRender', write: false, platform: 'browser' });
const script = bundle.outputFiles[0].contents;
const require = createRequire(import.meta.url), dracoRoot = resolve(dirname(require.resolve('three')), '../examples/jsm/libs/draco/gltf');
const allowedModels = new Set([...files.keys()]);
for (const file of files.values()) if (file.path.endsWith('.usdz')) { allowedModels.add(file.path.replace(/\.usdz$/, '.usda')); for (let i = 0; i < 3; i++) allowedModels.add(relative(cache, resolve(dirname(local(cache, file.path)), `0/image${i}.jpg`))); }
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    if (path === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><script src="/render.js"></script>'); return; }
    if (path === '/render.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(script); return; }
    let file: string;
    if (path.startsWith('/draco/') && ['draco_wasm_wrapper.js', 'draco_decoder.wasm', 'draco_decoder.js'].includes(path.slice(7))) file = local(dracoRoot, path.slice(7));
    else if (allowedModels.has(path.slice(1))) file = local(cache, path.slice(1));
    else { res.statusCode = 404; res.end(); return; }
    res.setHeader('Content-Type', extname(file) === '.js' ? 'text/javascript' : extname(file) === '.wasm' ? 'application/wasm' : 'application/octet-stream'); res.end(await readFile(file));
  } catch (error) { res.statusCode = 500; res.end(String(error)); }
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address(); if (!address || typeof address === 'string') throw new Error('Missing renderer address');
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true }).catch(error => { server.close(); throw error; });
const reports: unknown[] = [];
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 600 }, deviceScaleFactor: 1 });
  for (const entry of selected) {
    const id = requireString(entry.id), source = requireRecord(entry.source), model = requireRecord(source.model), camera = requireRecord(source.camera);
    const direction = requireArray(camera.direction).map(value => requireFiniteNumber(value));
    if (direction.length !== 3) throw new Error('Invalid camera direction');
    const usda = requireString(model.path).endsWith('.usdz');
    const request: RenderRequest = { id, url: origin + '/' + requireString(model.path).replace(/\.usdz$/, '.usda'), direction: [direction[0], direction[1], direction[2]], rollDegrees: 0, usda,
      ...(!inspectAxes ? { pose: getFacilityPose(id) } : {}) };
    if (inspectAxes) {
      for (const [axis, vector] of Object.entries({ xp: [1, 0, 0], xn: [-1, 0, 0], yp: [0, 1, 0], yn: [0, -1, 0], zp: [0, 0, 1], zn: [0, 0, -1] })) {
        const [x, y, z] = vector;
        const direction: [number, number, number] = usda ? [x, y, z] : [x, -z, y];
        await page.goto(origin);
        const result = await page.evaluate(request => window.FacilityRender.renderFacility(request), { ...request, direction, rollDegrees: 0 });
        await writeFile(resolve(output, `rendered/${id}-${axis}.png`), Buffer.from(result.png.replace(/^data:image\/png;base64,/, ''), 'base64'));
      }
      console.log(`${id}: six source-axis views`);
      continue;
    }
    if (inspectRolls) {
      const pose = getFacilityPose(id);
      for (const degrees of [0, 90, 180, 270]) {
        const q = new Quaternion().setFromAxisAngle(new Vector3(...inwardDirection).normalize(), MathUtils.degToRad(degrees)).multiply(new Quaternion(...pose.modelQuaternion));
        await page.goto(origin);
        const result = await page.evaluate(request => window.FacilityRender.renderFacility(request), { ...request, pose: { ...pose, modelQuaternion: q.toArray() } });
        await writeFile(resolve(output, `rendered/${id}-roll-${degrees}.png`), Buffer.from(result.png.replace(/^data:image\/png;base64,/, ''), 'base64'));
      }
      console.log(`${id}: four rolls around the facing direction`);
      continue;
    }
    await page.goto(origin); // Release the previous model, decoded textures and WebGL context.
    const errors: string[] = []; const error = (e: Error) => errors.push(e.message); page.on('pageerror', error);
    const result = await page.evaluate(async request => {
      if (!('FacilityRender' in window)) throw new Error('Renderer not loaded');
      return await window.FacilityRender.renderFacility(request);
    }, request);
    page.off('pageerror', error); if (errors.length) throw new Error(errors.join('\n'));
    const png = Buffer.from(result.png.replace(/^data:image\/png;base64,/, ''), 'base64');
    await writeFile(resolve(output, `rendered/${id}.png`), png);
    const webp = await sharp(png).resize(592, 296).webp({ quality: 90, alphaQuality: 100 }).toBuffer();
    const { data, info } = await sharp(webp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let left = info.width, top = info.height, right = -1, bottom = -1, coverage = 0;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 0) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); coverage++; }
    if (coverage < 300 || left < 4 || top < 4 || right > 587 || bottom > 291) throw new Error(`Empty or clipped thumbnail: ${id}`);
    left = Math.max(0, left - 6); top = Math.max(0, top - 6); right = Math.min(591, right + 6); bottom = Math.min(295, bottom + 6);
    const destination = resolve(root, 'public' + requireString(entry.url));
    try { await copyFile(destination, resolve(output, `before/${id}.webp`), 1); } catch (error) { if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error; }
    await writeFile(resolve(output, `rendered/${id}.webp`), webp);
    entry.bytes = webp.length; entry.subject = { left, top, width: right - left + 1, height: bottom - top + 1 };
    entry.composition = { scale: 1, offsetXCssPixels: 0 };
    entry.processing = { recipe: 'tools/facility-renders/render.mts#recipe', sourceMaterials: 'unchanged', triangles: result.report.triangles, omissions: result.report.omissions, camera: result.report.camera, pose: result.report.pose };
    reports.push({ ...result.report, bytes: webp.length, sha256: sha256(webp), subject: entry.subject });
    console.log(`${id}: ${result.report.triangles} triangles; ${webp.length} bytes; ${result.report.omissions.reduce((n, v) => n + v.triangles, 0)} omitted`);
  }
  if (!inspectAxes && !inspectRolls) {
    library.renderer = { ...await page.evaluate(() => { if (!('FacilityRender' in window)) throw new Error('Renderer not loaded'); return window.FacilityRender.recipe; }), browser: browser.version(), sharp: sharp.versions.sharp,
      implementation: Object.fromEntries(await Promise.all(['tools/prepare/prepare-facility-renders.mts', 'tools/facility-renders/render.mts', 'tools/facility-renders/poses.mts', 'tools/facility-renders/voyager.mts', 'tools/facility-renders/refresh.mts'].map(async file => [file, sha256(await readFile(resolve(root, file)))]))) };
    library.composition = { background: 'transparent for model renders', displaySize: [296, 148], preserveAspectRatio: true, fitPolicy: 'Center retained source geometry; alpha bounds with 6px padding supply sidebar crop.' };
    await writeFile(resolve(output, 'render-report.json'), JSON.stringify(reports, null, 2) + '\n');
    await writeFile(resolve(output, 'render-library.candidate.json'), JSON.stringify(library, null, 2) + '\n');
    if (write) {
      if (!(await readFile(libraryPath)).equals(libraryBefore)) throw new Error('Artwork library changed during rendering; review before retrying');
      const next = Buffer.from(JSON.stringify(library, null, 2) + '\n');
      const images = new Map(await Promise.all(selected.map(async entry => ['public' + requireString(entry.url), await readFile(resolve(output, `rendered/${requireString(entry.id)}.webp`))] satisfies [string, Buffer])));
      const graphs = await prepareArtworkRefresh(root, libraryBefore, next, images);
      await writePreparedSet([...selected.map(entry => ({ path: resolve(root, 'public' + requireString(entry.url)), source: resolve(output, `rendered/${requireString(entry.id)}.webp`) })),
        { path: libraryPath, text: next }, ...graphs]);
    }
  }
} finally { await browser.close(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
console.log(`${selected.length} thumbnails ${write ? 'published locally' : 'ready for review'} in ${output}`);
