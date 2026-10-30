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

export const ALL_BACKGROUND_DIR = L37_DIR + 'background-all/';
const STRIP = 256;
async function plane(i: number) {
  const { source, regions, background } = await allGasSource(), spec = nativeBankSpec(2048); await refineFields(source.scene);
  const layout = fullDescriptors()[i]!, stem = `local-${layout.axis}-${layout.index}`, t = performance.now(), camera = planeCamera(spec, layout), mask = new Uint8Array(layout.width * layout.height);
  for (const r of regions) for (const e of r.emitters) if (intersectsSlab(e.object, layout.domain)) for (const p of projectObject(e.object, camera, 2)) mask[p.pixel] = 1;
  const selected = mask.reduce((n, v) => n + v, 0), rgb = new Float64Array(Uint8Array.from(await readFile(FULL_DIR + stem + '-rgb.f64le')).buffer), tau = new Float64Array(Uint8Array.from(await readFile(FULL_DIR + stem + '-tau.f64le')).buffer);
  for (let left = 0; left < layout.width; left += STRIP) {
    const part = new Uint8Array(mask.length); let any = false;
    for (let y = 0; y < layout.height; y++) for (let x = left; x < Math.min(layout.width, left + STRIP); x++) if (mask[y * layout.width + x]) { part[y * layout.width + x] = 1; any = true; }
    if (!any) continue;
    const fresh = projectLmcSlab({ ...source, scene: background }, layout.domain, camera, true, part);
    for (let p = 0; p < part.length; p++) if (part[p]) { rgb[p * 3] = fresh.rgb[p * 3]!; rgb[p * 3 + 1] = fresh.rgb[p * 3 + 1]!; rgb[p * 3 + 2] = fresh.rgb[p * 3 + 2]!; tau[p] = fresh.tau[p]!; }
  }
  await writeFile(ALL_BACKGROUND_DIR + stem + '-rgb.f64le', Buffer.from(rgb.buffer)); await writeFile(ALL_BACKGROUND_DIR + stem + '-tau.f64le', Buffer.from(tau.buffer));
  await writeFile(ALL_BACKGROUND_DIR + stem + '.json', JSON.stringify({ complete: true, axis: layout.axis, index: layout.index, selectedPixels: selected, seconds: (performance.now() - t) / 1000 }) + '\n');
  console.log('GAS_ALL_PLANE_DONE ' + i + ' ' + selected + ' ' + (performance.now() - t) / 1000);
}
async function batch(workers: number) {
  await mkdir(ALL_BACKGROUND_DIR, { recursive: true }); const list = fullDescriptors(); let next = 0;
  const pending = (await Promise.all(list.map(async (l, i) => (await access(ALL_BACKGROUND_DIR + `local-${l.axis}-${l.index}.json`).then(() => true, () => false)) ? -1 : i))).filter(i => i >= 0);
  const run = async () => { while (next < pending.length) { const i = pending[next++]!; await new Promise<void>((resolve, reject) => { const child = spawn(process.execPath, ['--max-old-space-size=9000', fileURLToPath(import.meta.url), 'plane', String(i)], { stdio: ['ignore', 'inherit', 'inherit'] }); child.once('close', c => c === 0 ? resolve() : reject(Error('Plane failed ' + i))); }); } };
  await Promise.all(Array.from({ length: workers }, run));
  await copyFile(FULL_DIR + 'local-planes.json', ALL_BACKGROUND_DIR + 'local-planes.json');
  const planes = await readLocalPlanes(ALL_BACKGROUND_DIR), frozen = rec(await json(NEAR_DIR + 'compression-fit.json'));
  const fits: GalaxyBankFit[] = array(frozen.fits).map(value => { const r = rec(value), c = numbers(r.rgb, 3); return { rgb: [c[0]!, c[1]!, c[2]!], gamma: num(r.gamma), dust: num(r.dust), emissionOpacity: num(r.emissionOpacity) }; }); need(fits.length === 3, 'Missing frozen encoding');
  await writeGalaxyModelBank(ALL_BACKGROUND_DIR + 'bank/', nativeBankSpec(2048), planes, fits, new Set(array(frozen.dense).map(String)));
  await writeFile(ALL_BACKGROUND_DIR + 'result.json', JSON.stringify({ complete: true, physicalParametersChanged: 0, encodingParametersChanged: 0 }) + '\n'); console.log('GAS_ALL_BACKGROUND_COMPLETE');
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) { if (process.argv[2] === 'plane') await plane(Number(process.argv[3])); else await batch(Number(process.argv[2] ?? 5)); }
