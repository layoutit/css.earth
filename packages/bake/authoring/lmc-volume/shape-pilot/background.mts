/** The diffuse galaxy stays continuous. Only the selected emitting objects leave its source list. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { validatePreparedCssVolume } from '@cssearth/objects';
import { approvedScene } from '../delivery/reference.mts';
import { refineFields } from '../delivery/refined-fields.mts';
import { projectPiece } from '../piece-pilot/project.mts';
import { galaxyNearStations } from '../../milky-way-dust/galaxy-near-cameras.mts';
import { planeCamera, planeLayout, hybridGalaxyPlanes, selectDenseSlabs, type GalaxyPlane, type GalaxyBankFit, type GalaxyDecodedPlane } from '../../milky-way-dust/galaxy-fitted-bank.mts';
import { NEAR_DIR } from '../delivery/near-pilot.mts';
import { nearAnnuli } from '../delivery/milky-way-near.mts';
import { array, json, need, num, numbers, rec } from '../inputs.mts';
import { readShapeSource, partitionEmitters, effectiveEmitters, SHAPE_DIR } from './source.mts';
import { backgroundSpec, encodePart, mergeVolumes, quickFit, shapeSpec } from './build.mts';
import { finiteEmission } from './project.mts';

function fitsFrom(input: unknown): GalaxyBankFit[] {
  const fits = array(rec(input).fits).map(v => { const r = rec(v), rgb = numbers(r.rgb, 3); return { rgb: [rgb[0]!, rgb[1]!, rgb[2]!] as [number, number, number], gamma: num(r.gamma), dust: num(r.dust), emissionOpacity: num(r.emissionOpacity) }; });
  need(fits.length === 3, 'Missing finite bank encoding'); return fits;
}

export async function buildBackground() {
  const pilot = rec(await json(SHAPE_DIR + 'cloud/site/result.json')); need(pilot.complete === true && pilot.oneView === false, 'The first finite shape must run end to end in every pilot view before adding the galaxy');
  const source = await approvedScene(), saved = await readShapeSource(); need(isDeepStrictEqual(source.grade, saved.grade), 'The physical grade changed');
  for (const s of saved.shapes) {
    for (const e of s.emitters) need(isDeepStrictEqual(source.scene.objects.find(o => o.id === e.object.id), e.object), 'The selected research geometry changed');
    need(isDeepStrictEqual(effectiveEmitters(source.scene, source.amplitudes, s.emitters.map(e => e.object)), s.emitters), 'The source gas luminosity changed');
  }
  await refineFields(source.scene); const scene = partitionEmitters(source.scene, saved.shapes), spec = backgroundSpec(), directory = SHAPE_DIR + 'background/'; await mkdir(directory, { recursive: true });
  const planes: GalaxyPlane[] = [], started = performance.now();
  for (const axis of [0, 1, 2] as const) for (let index = 0; index < spec.counts[axis]; index++) {
    const layout = planeLayout(spec, axis, index), prefix = directory + axis + '-' + index;
    const done = await json(prefix + '.json').catch(e => { if (e && typeof e === 'object' && 'code' in e && e.code === 'ENOENT') return null; throw e; });
    if (done) {
      need(rec(done).complete === true && isDeepStrictEqual(rec(done).spec, spec) && isDeepStrictEqual(rec(done).removedEmitterIds, saved.shapes.flatMap(s => s.emitters.map(e => e.object.id))), 'Changed background checkpoint');
      const rgb = await readFile(prefix + '-rgb.f64le'), tau = await readFile(prefix + '-tau.f64le'); need(rgb.length === layout.width * layout.height * 24 && tau.length === layout.width * layout.height * 8, 'Incomplete background plane');
      planes.push({ ...layout, rgb: new Float64Array(Uint8Array.from(rgb).buffer), tau: new Float64Array(Uint8Array.from(tau).buffer) }); continue;
    }
    const t = performance.now(), p = projectPiece({ ...source, scene }, planeCamera(spec, layout), layout.domain); planes.push({ ...layout, ...p });
    await writeFile(prefix + '-rgb.f64le', Buffer.from(p.rgb.buffer)); await writeFile(prefix + '-tau.f64le', Buffer.from(p.tau.buffer));
    await writeFile(prefix + '.json', JSON.stringify({ complete: true, spec, removedEmitterIds: saved.shapes.flatMap(s => s.emitters.map(e => e.object.id)), seconds: (performance.now() - t) / 1000 }) + '\n'); console.log('CONTINUOUS_BACKGROUND_PLANE ' + axis + ' ' + index);
  }
  const fixed: GalaxyDecodedPlane[] = [];
  for (const shape of saved.shapes) {
    const localSpec = shapeSpec(shape), localPlanes: GalaxyPlane[] = [];
    for (const axis of [0, 1, 2] as const) for (let index = 0; index < localSpec.counts[axis]; index++) { const layout = planeLayout(localSpec, axis, index), p = finiteEmission(shape, planeCamera(localSpec, layout), saved.grade, layout.domain); localPlanes.push({ ...layout, ...p }); }
    const decoded = hybridGalaxyPlanes(localPlanes, fitsFrom(await json(SHAPE_DIR + shape.id + '/fit.json')), selectDenseSlabs(localPlanes, localSpec));
    for (const p of decoded) { const h = p.axis === 0 ? 1 : 0, v = p.axis === 2 ? 1 : 2; fixed.push({ ...p, imageBounds: [shape.box.min[h], shape.box.max[h], shape.box.min[v], shape.box.max[v]] }); }
  }
  const targets = [];
  for (const t of galaxyNearStations(128, 10)) {
    const meta = rec(await json(NEAR_DIR + t.camera.name + '-reference.json')); need(meta.complete === true && meta.stepPc === 15 && meta.fields === 2048, 'Use the existing native physical reference');
    const bytes = await readFile(NEAR_DIR + t.camera.name + '-reference.f64le'); need(bytes.length === 128 * 128 * 24, 'Incomplete physical reference');
    targets.push({ name: t.camera.name, axis: t.axis, camera: t.camera, linear: new Float64Array(Uint8Array.from(bytes).buffer), annuli: nearAnnuli(t.camera, [0, 0, 0], 10) });
  }
  const fit = quickFit(planes, spec, targets, fixed), background = await encodePart('background', spec, planes, fit.fits);
  const volumes = [{ id: 'background', volume: background }];
  for (const s of saved.shapes) volumes.push({ id: s.id, volume: validatePreparedCssVolume(await json(SHAPE_DIR + 'banks/' + s.id + '/volume.json')) });
  const volume = mergeVolumes(volumes); need(volume.stacks.reduce((n, s) => n + s.leaves.length, 0) === 33, 'The combined pilot must retain exactly 33 layers');
  await writeFile(SHAPE_DIR + 'combined-volume.json', JSON.stringify(volume) + '\n');
  await writeFile(directory + 'result.json', JSON.stringify({ ...fit, images: undefined, complete: true, physicalParametersChanged: 0, dustOwner: 'background only', smoothFieldsCut: false, removedEmitterCount: saved.shapes.reduce((n, s) => n + s.emitters.length, 0), seconds: (performance.now() - started) / 1000 }, null, 2) + '\n');
  console.log('CONTINUOUS_GALAXY_WITH_SHAPES_COMPLETE');
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await buildBackground();
