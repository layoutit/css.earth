/** The accepted native l36 slabs with the pilot regions' gas removed. Only pixels those emitters touch are projected again. */
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { planeCamera, writeGalaxyModelBank, type GalaxyBankFit } from '../../milky-way-dust/galaxy-fitted-bank.mts';
import { refineFields } from '../delivery/refined-fields.mts';
import { FULL_DIR, NEAR_DIR, nativeBankSpec } from '../delivery/near-pilot.mts';
import { fullDescriptors } from '../delivery/full-native.mts';
import { intersectsSlab, projectLmcSlab, readLocalPlanes } from '../delivery/slab-source.mts';
import { projectObject } from '../catalogue-render.mts';
import { array, json, need, num, numbers, rec } from '../inputs.mts';
import { L37_DIR, pilotSource } from './regions.mts';

export const BACKGROUND_DIR = L37_DIR + 'background/';

export async function buildBackground() {
  const { source, regions, background } = await pilotSource(), spec = nativeBankSpec(2048); await refineFields(source.scene);
  const removed = regions.flatMap(r => r.emitters.map(e => e.object)), local = { ...source, scene: background }, started = performance.now(), rows = [];
  await mkdir(BACKGROUND_DIR, { recursive: true });
  for (const layout of fullDescriptors()) {
    const stem = `local-${layout.axis}-${layout.index}`, t = performance.now();
    const done = await json(BACKGROUND_DIR + stem + '.json').catch(() => null);
    if (done && rec(done).complete === true) { rows.push(done); continue; }
    const camera = planeCamera(spec, layout), mask = new Uint8Array(layout.width * layout.height);
    for (const o of removed) if (intersectsSlab(o, layout.domain)) for (const p of projectObject(o, camera, 2)) mask[p.pixel] = 1;
    const selected = mask.reduce((n, v) => n + v, 0), rgbBytes = await readFile(FULL_DIR + stem + '-rgb.f64le'), tauBytes = await readFile(FULL_DIR + stem + '-tau.f64le');
    const rgb = new Float64Array(Uint8Array.from(rgbBytes).buffer), tau = new Float64Array(Uint8Array.from(tauBytes).buffer);
    if (selected) {
      const fresh = projectLmcSlab(local, layout.domain, camera, true, mask);
      for (let p = 0; p < mask.length; p++) if (mask[p]) { rgb[p * 3] = fresh.rgb[p * 3]!; rgb[p * 3 + 1] = fresh.rgb[p * 3 + 1]!; rgb[p * 3 + 2] = fresh.rgb[p * 3 + 2]!; tau[p] = fresh.tau[p]!; }
    }
    await writeFile(BACKGROUND_DIR + stem + '-rgb.f64le', Buffer.from(rgb.buffer)); await writeFile(BACKGROUND_DIR + stem + '-tau.f64le', Buffer.from(tau.buffer));
    const row = { complete: true, axis: layout.axis, index: layout.index, selectedPixels: selected, seconds: (performance.now() - t) / 1000 };
    await writeFile(BACKGROUND_DIR + stem + '.json', JSON.stringify(row) + '\n'); rows.push(row); console.log('GAS_BACKGROUND_PLANE ' + JSON.stringify(row));
  }
  await copyFile(FULL_DIR + 'local-planes.json', BACKGROUND_DIR + 'local-planes.json');
  const planes = await readLocalPlanes(BACKGROUND_DIR), frozen = rec(await json(NEAR_DIR + 'compression-fit.json'));
  const fits: GalaxyBankFit[] = array(frozen.fits).map(value => { const r = rec(value), c = numbers(r.rgb, 3); return { rgb: [c[0]!, c[1]!, c[2]!], gamma: num(r.gamma), dust: num(r.dust), emissionOpacity: num(r.emissionOpacity) }; });
  need(fits.length === 3, 'Missing frozen encoding');
  await writeGalaxyModelBank(BACKGROUND_DIR + 'bank/', spec, planes, fits, new Set(array(frozen.dense).map(String)));
  await writeFile(BACKGROUND_DIR + 'result.json', JSON.stringify({ complete: true, removedEmitters: removed.length, regions: regions.map(r => ({ id: r.id, emitters: r.emitters.length })), physicalParametersChanged: 0, encodingParametersChanged: 0, rows, seconds: (performance.now() - started) / 1000 }, null, 2) + '\n');
  console.log('GAS_BACKGROUND_COMPLETE');
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await buildBackground();
