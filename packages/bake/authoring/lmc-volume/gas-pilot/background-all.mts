/** The accepted native slabs with all catalogue gas removed. Pixels no gas object touches keep their accepted bytes. Resumable per plane. */
import { mkdir, readFile, writeFile, copyFile, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { planeCamera, writeGalaxyModelBank, type GalaxyBankFit } from '../../milky-way-dust/galaxy-fitted-bank.mts';
import { refineFields } from '../delivery/refined-fields.mts';
import { FULL_DIR, NEAR_DIR, nativeBankSpec } from '../delivery/near-pilot.mts';
import { fullDescriptors } from '../delivery/full-native.mts';
import { intersectsSlab, projectLmcSlab, readLocalPlanes } from '../delivery/slab-source.mts';
import { projectObject } from '../catalogue-render.mts';
import { array, json, need, num, numbers, rec } from '../inputs.mts';
import { L37_DIR, allGasSource } from './regions.mts';

export const ALL_BACKGROUND_DIR = L37_DIR + 'background-all/', SMOOTH_BACKGROUND_DIR = L37_DIR + 'background-smooth/';
/** Without its discrete dust clouds a slab holds only the smooth column; the clouds move to dark dots. */
const ARM = process.env.GRADE_ARM, SMOOTH = process.argv.includes('--smooth') || Boolean(ARM), OUT_DIR = ARM ? L37_DIR + 'background-' + ARM + '/' : SMOOTH ? SMOOTH_BACKGROUND_DIR : ALL_BACKGROUND_DIR;
const STRIP = 256;
async function plane(i: number) {
  const { source, regions, background: gasFree } = await allGasSource(), background = SMOOTH ? { ...gasFree, dustLayer: { ...gasFree.dustLayer!, clouds: [] } } : gasFree, spec = nativeBankSpec(2048); await refineFields(source.scene); const grade = ARM ? (rec(await json(L37_DIR + 'grades/' + ARM + '.json')).grade as typeof source.grade) : source.grade;
  const layout = fullDescriptors()[i]!, stem = `local-${layout.axis}-${layout.index}`, t = performance.now(), camera = planeCamera(spec, layout), mask = new Uint8Array(layout.width * layout.height);
  if (SMOOTH) mask.fill(1); else for (const r of regions) for (const e of r.emitters) if (intersectsSlab(e.object, layout.domain)) for (const p of projectObject(e.object, camera, 4)) mask[p.pixel] = 1;
  // A clump smaller than a few texels is drawn by a kernel wider than its footprint, so the mask reaches two texels past it.
  if (!SMOOTH) for (let pass = 0; pass < 2; pass++) { const grown = mask.slice(); for (let y = 0; y < layout.height; y++) for (let x = 0; x < layout.width; x++) if (mask[y * layout.width + x]) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < layout.width && Y < layout.height) grown[Y * layout.width + X] = 1; } mask.set(grown); }
  const selected = mask.reduce((n, v) => n + v, 0), rgb = new Float64Array(Uint8Array.from(await readFile(FULL_DIR + stem + '-rgb.f64le')).buffer), tau = new Float64Array(Uint8Array.from(await readFile(FULL_DIR + stem + '-tau.f64le')).buffer);
  for (let left = 0; left < layout.width; left += STRIP) {
    const part = new Uint8Array(mask.length); let any = false;
    for (let y = 0; y < layout.height; y++) for (let x = left; x < Math.min(layout.width, left + STRIP); x++) if (mask[y * layout.width + x]) { part[y * layout.width + x] = 1; any = true; }
    if (!any) continue;
    const fresh = projectLmcSlab({ ...source, grade, scene: background }, layout.domain, camera, true, part);
    for (let p = 0; p < part.length; p++) if (part[p]) { rgb[p * 3] = fresh.rgb[p * 3]!; rgb[p * 3 + 1] = fresh.rgb[p * 3 + 1]!; rgb[p * 3 + 2] = fresh.rgb[p * 3 + 2]!; tau[p] = fresh.tau[p]!; }
  }
  await writeFile(OUT_DIR + stem + '-rgb.f64le', Buffer.from(rgb.buffer)); await writeFile(OUT_DIR + stem + '-tau.f64le', Buffer.from(tau.buffer));
  await writeFile(OUT_DIR + stem + '.json', JSON.stringify({ complete: true, axis: layout.axis, index: layout.index, selectedPixels: selected, seconds: (performance.now() - t) / 1000 }) + '\n');
  console.log('GAS_ALL_PLANE_DONE ' + i + ' ' + selected + ' ' + (performance.now() - t) / 1000);
}
async function batch(workers: number) {
  await mkdir(OUT_DIR, { recursive: true }); const list = fullDescriptors(); let next = 0;
  const pending = (await Promise.all(list.map(async (l, i) => (await access(OUT_DIR + `local-${l.axis}-${l.index}.json`).then(() => true, () => false)) ? -1 : i))).filter(i => i >= 0);
  const run = async () => { while (next < pending.length) { const i = pending[next++]!; await new Promise<void>((resolve, reject) => { const child = spawn(process.execPath, ['--max-old-space-size=9000', fileURLToPath(import.meta.url), 'plane', String(i), ...(SMOOTH ? ['--smooth'] : [])], { stdio: ['ignore', 'inherit', 'inherit'] }); child.once('close', c => c === 0 ? resolve() : reject(Error('Plane failed ' + i))); }); } };
  await Promise.all(Array.from({ length: workers }, run));
  await copyFile(FULL_DIR + 'local-planes.json', OUT_DIR + 'local-planes.json');
  const planes = await readLocalPlanes(OUT_DIR), frozen = rec(await json(NEAR_DIR + 'compression-fit.json'));
  const fits: GalaxyBankFit[] = array(frozen.fits).map(value => { const r = rec(value), c = numbers(r.rgb, 3); return { rgb: [c[0]!, c[1]!, c[2]!], gamma: num(r.gamma), dust: num(r.dust), emissionOpacity: num(r.emissionOpacity) }; }); need(fits.length === 3, 'Missing frozen encoding');
  await writeGalaxyModelBank(OUT_DIR + 'bank/', nativeBankSpec(2048), planes, fits, new Set(array(frozen.dense).map(String)));
  await writeFile(OUT_DIR + 'result.json', JSON.stringify({ complete: true, physicalParametersChanged: 0, encodingParametersChanged: 0 }) + '\n'); console.log('GAS_ALL_BACKGROUND_COMPLETE');
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) { if (process.argv[2] === 'plane') await plane(Number(process.argv[3])); else await batch(Number(process.argv[2] ?? 5)); }
