/** Tiny shape bake, using the existing galaxy projector, encoder, compositor and bounded fit. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import sharp from 'sharp';
import { validatePreparedCssVolume, type PreparedCssVolume } from '@cssearth/objects';
import { hybridOpticalOpacity } from '@cssearth/core';
import { bankSpec, planeCamera, planeLayout, writeGalaxyModelBank, hybridGalaxyPlanes, encodeGalaxyPlane, selectDenseSlabs, IDENTITY_BANK_FIT, type GalaxyBankSpec, type GalaxyPlane, type GalaxyBankFit, type GalaxyDecodedPlane } from '../../milky-way-dust/galaxy-fitted-bank.mts';
import { evaluateGalaxyBank, type GalaxyFitTarget } from '../../milky-way-dust/galaxy-bank-fit.mts';
import { minimizeBox } from '../../milky-way-dust/galaxy-fit-search.mts';
import { prepareGalaxyCompositor } from '../../milky-way-dust/galaxy-compositor-cache.mts';
import { compileGalaxySliceVolume } from '../../milky-way-dust/galaxy-slice-compile.mts';
import { deliveryPhysicalFrame } from '../delivery/delivery-frame.mts';
import { regionCameras } from '../piece-pilot/cameras.mts';
import { finiteEmission } from './project.mts';
import { compileFiniteBank } from './compile.mts';
import { readShapeSource, SHAPE_DIR, type Shape } from './source.mts';
import { json, need, rec } from '../inputs.mts';

export const backgroundBox = { min: [-10, -10, -2.1] as [number, number, number], max: [10, 10, 2.1] as [number, number, number] };
export function shapeSpec(shape: Pick<Shape, 'box'> & { id: string }, size = 128): GalaxyBankSpec {
  need(size === 128, 'Show the tiny shape pilot before any increase in resolution');
  return bankSpec({ box: shape.box, counts: [3, 3, 2], size, record: 'source/preparation/l36/fit.json', texturePrefix: 'l36-shape-' + shape.id, hybrid: { densePerAxis: [1, 1, 1] } });
}
export const backgroundSpec = () => bankSpec({ box: backgroundBox, counts: [4, 4, 3], size: 128, record: 'source/preparation/l36/fit.json', texturePrefix: 'l36-shape-background', hybrid: { densePerAxis: [0, 0, 0] } });
const srgb = (v: number) => { const x = Math.min(1, Math.max(0, v)); return Math.round(255 * (x <= .0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - .055)); };
export async function png(path: string, rgb: Float64Array, width: number, height: number) { await sharp(Uint8Array.from(rgb, srgb), { raw: { width, height, channels: 3 } }).png().toFile(path); }

export function mergeVolumes(volumes: readonly { id: string; volume: PreparedCssVolume }[]) {
  need(volumes.length > 0, 'No finite volumes to compile');
  const first = volumes[0]!.volume;
  const volume = validatePreparedCssVolume({ ...first, frame: { ...first.frame, boundsUnits: volumes.length === 1 ? first.frame.boundsUnits : backgroundBox },
    stacks: (['x', 'y', 'z'] as const).map(axis => ({ axis, leaves: volumes.flatMap(({ id, volume }) => volume.stacks.find(s => s.axis === axis)!.leaves.map(l => ({ ...l, id: id + '-' + l.id, ...(l.opticalSlab ? { opticalSlab: { ...l.opticalSlab, id: id + '-' + l.opticalSlab.id } } : {}) }))) })),
    resources: volumes.flatMap(v => v.volume.resources),
    provenance: { model: 'l36', method: 'Finite gas emitters retain their own geometry and emission. All smooth light and all physical dust remain in the continuous background.', generator: 'packages/bake/authoring/lmc-volume/shape-pilot/build.mts' },
    approximation: { experimental: true, size: 128, modelParametersChanged: 0, physicalDustOwner: 'background only', parts: volumes.map(v => v.id) },
  });
  need(volume.stacks.reduce((n, s) => n + s.leaves.length, 0) <= 33, 'The shape pilot exceeds 33 optical layers');
  for (let a = 0; a < 3; a++) need(new Set(volume.stacks[a]!.leaves.map(l => l.centerUnits[a])).size <= [13, 13, 7][a]!, 'Physical axis budget exceeded');
  return volume;
}

export async function encodePart(id: string, spec: GalaxyBankSpec, planes: GalaxyPlane[], fits: GalaxyBankFit[]) {
  const directory = SHAPE_DIR + 'banks/' + id + '/';
  await writeGalaxyModelBank(directory, spec, planes, fits);
  const volume = id === 'background'
    ? compileGalaxySliceVolume(await json(directory + 'prototype.json'), deliveryPhysicalFrame(), directory, 'lmc-volume', { record: spec.record, texturePrefix: spec.texturePrefix })
    : compileFiniteBank(await json(directory + 'prototype.json'), directory, { record: spec.record, texturePrefix: spec.texturePrefix });
  const dense = selectDenseSlabs(planes, spec), decoded = hybridGalaxyPlanes(planes, fits, dense); let alpha = 0, delivered = 0;
  for (const p of planes.filter(p => p.axis === 2)) { const original = encodeGalaxyPlane(p, fits[2]!, false), parts = decoded.filter(v => v.axis === 2 && v.index === p.index); for (let i = 3; i < original.rgba.length; i += 4) { let t = 1; for (const part of parts) t *= 1 - part.rgba[i]! / 255 * hybridOpticalOpacity(part.opticalRole!, 1); alpha += original.rgba[i]! / 255; delivered += 1 - t; } }
  await writeFile(directory + 'volume.json', JSON.stringify(volume) + '\n');
  await writeFile(directory + 'encoding.json', JSON.stringify({ complete: true, id, spec, fits, dense: [...dense], layers: decoded.length, faceOnEffectiveAlphaLoss: alpha > 0 ? 1 - delivered / alpha : 0, meaning: 'Effective alpha, not luminosity loss. Dust is absent from finite emitting pieces.' }, null, 2) + '\n');
  return volume;
}

export function quickFit(planes: GalaxyPlane[], spec: GalaxyBankSpec, targets: GalaxyFitTarget[], fixed: readonly GalaxyDecodedPlane[] = []) {
  const fits: GalaxyBankFit[] = [0, 1, 2].map(() => ({ ...IDENTITY_BANK_FIT, rgb: [1, 1, 1], emissionOpacity: 2 })), dense = selectDenseSlabs(planes, spec), trajectory = [];
  const cached = (source: readonly GalaxyDecodedPlane[], group: GalaxyFitTarget[]) => new Map(group.map(t => {
    const composite = prepareGalaxyCompositor([...source, ...fixed], spec.box, t.camera, t.axis);
    return [t.name, (current: readonly GalaxyDecodedPlane[]) => composite([...current, ...fixed])] as const;
  }));
  for (const axis of [0, 1, 2] as const) {
    const group = targets.filter(t => t.axis === axis); need(group.length > 0, 'Every axis requires a physical comparison');
    const local = planes.filter(p => p.axis === axis), template = hybridGalaxyPlanes(local, fits, dense), compositors = cached(template, group);
    const decode = (x: number[]): GalaxyBankFit => ({ rgb: [Math.exp(x[0]!), Math.exp(x[1]!), Math.exp(x[2]!)], gamma: Math.exp(x[3]!), emissionOpacity: Math.exp(x[4]!), dust: 1 });
    const score = (x: number[]) => { const trial = fits.map((f, a) => a === axis ? decode(x) : f); return evaluateGalaxyBank(local, spec, group, trial, dense, compositors).score; };
    const initial = [...fits[axis]!.rgb, fits[axis]!.gamma, fits[axis]!.emissionOpacity!].map(Math.log), start = performance.now(), baseline = score(initial), evaluationSeconds = (performance.now() - start) / 1000;
    need(evaluationSeconds < 2, 'One tiny fitting evaluation is too expensive; do not scale the search');
    const bounds = [[Math.log(.03), Math.log(6)], [Math.log(.03), Math.log(6)], [Math.log(.03), Math.log(6)], [Math.log(.5), Math.log(2)], [Math.log(.1), Math.log(8)]] as const;
    const result = minimizeBox(score, initial, bounds, 45); fits[axis] = decode(result.x); trajectory.push({ axis, baseline, fitted: result.value, evaluationSeconds, maximumIterations: 45 });
    console.log('FINITE_ENCODING_FIT ' + JSON.stringify(trajectory.at(-1)));
  }
  return { fits, trajectory, ...evaluateGalaxyBank(planes, spec, targets, fits, dense, cached(hybridGalaxyPlanes(planes, fits, dense), targets)) };
}

export async function buildShape(id: string) {
  const source = await readShapeSource(), shape = source.shapes.find(s => s.id === id); need(shape, 'Unknown finite shape');
  const spec = shapeSpec(shape), directory = SHAPE_DIR + id + '/'; await mkdir(directory, { recursive: true });
  const configuration = { spec, shape, grade: source.grade }, old = await json(directory + 'configuration.json').catch(e => { if (e && typeof e === 'object' && 'code' in e && e.code === 'ENOENT') return null; throw e; });
  if (old) need(isDeepStrictEqual(old, configuration), 'The tiny shape checkpoint changed'); else await writeFile(directory + 'configuration.json', JSON.stringify(configuration) + '\n');
  const planes: GalaxyPlane[] = [], started = performance.now();
  for (const axis of [0, 1, 2] as const) for (let index = 0; index < spec.counts[axis]; index++) {
    const layout = planeLayout(spec, axis, index), p = finiteEmission(shape, planeCamera(spec, layout), source.grade, layout.domain); planes.push({ ...layout, rgb: p.rgb, tau: p.tau });
  }
  const targets = regionCameras(id, shape.box).map(camera => {
    const linear = finiteEmission(shape, camera, source.grade).rgb, annuli = Uint8Array.from({ length: 128 * 128 }, (_, p) => { const r = Math.hypot(p % 128 - 63.5, Math.floor(p / 128) - 63.5) / 128; return r < .12 ? 0 : r < .25 ? 1 : r < .4 ? 2 : 3; });
    const axis: 0 | 1 | 2 = Math.abs(camera.back[2]) > .7 ? 2 : Math.abs(camera.back[0]) > Math.abs(camera.back[1]) ? 0 : 1;
    return { name: camera.name, camera, axis, linear, annuli };
  });
  for (const t of targets) await png(directory + t.name + '-reference.png', t.linear, 128, 128);
  const fit = quickFit(planes, spec, targets), volume = await encodePart(id, spec, planes, fit.fits);
  await writeFile(directory + 'fit.json', JSON.stringify({ ...fit, images: undefined, complete: true, physicalParametersChanged: 0, freeCompressionParameters: 15, seconds: (performance.now() - started) / 1000 }, null, 2) + '\n');
  await writeFile(SHAPE_DIR + id + '-volume.json', JSON.stringify(mergeVolumes([{ id, volume }])) + '\n');
  console.log('FINITE_SHAPE_BANK_COMPLETE ' + id);
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await buildShape(process.argv[2] ?? 'cloud');
