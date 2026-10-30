/** Explicit finite emitters. The background retains every smooth field and every dust column. */
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { approvedScene, APPROVED_COMMIT } from '../delivery/reference.mts';
import { volumeObject, type VolumeObject } from '../catalogue-volume.mts';
import type { CatalogueScene } from '../catalogue-scene.mts';
import { readGrade, type Grade } from '../grade.mts';
import type { RegionBox } from '../piece-pilot/regions.mts';
import { array, json, need, num, numbers, rec } from '../inputs.mts';
import type { V3 } from '../geometry.mts';

export const SHAPE_DIR = 'src/objects/lmc-volume/.local/versions/l36/shape-pilot/';
export interface Emitter { object: VolumeObject; amplitude: number; }
export interface Shape { id: 'cloud' | 'shell'; label: string; box: RegionBox; emitters: Emitter[]; }
export interface ShapeSource { approvedCommit: string; gasGain: number; grade: Grade; shapes: Shape[]; }
const vector = (value: unknown): V3 => { const a = numbers(value, 3); return [a[0]!, a[1]!, a[2]!]; };

export function shapeBounds(objects: readonly VolumeObject[]): RegionBox {
  need(objects.length > 0, 'A finite shape needs geometry');
  const min: V3 = [Infinity, Infinity, Infinity], max: V3 = [-Infinity, -Infinity, -Infinity];
  for (const o of objects) for (let a = 0; a < 3; a++) {
    const radius = Math.sqrt(o.axes.reduce((n, r, k) => n + (r * o.basis[k]![a]!) ** 2, 0));
    min[a] = Math.min(min[a]!, o.center[a]! - radius); max[a] = Math.max(max[a]!, o.center[a]! + radius);
  }
  for (let a = 0; a < 3; a++) { const guard = Math.max(.00025, (max[a]! - min[a]!) * .03); min[a] -= guard; max[a] += guard; }
  return { min, max };
}

export function partitionEmitters(scene: CatalogueScene, shapes: readonly Pick<Shape, 'emitters'>[]): CatalogueScene {
  const ids = shapes.flatMap(s => s.emitters.map(e => e.object.id));
  need(new Set(ids).size === ids.length, 'An emitter must have exactly one owner');
  const chosen = new Set(ids), present = new Set(scene.objects.map(o => o.id));
  need(ids.every(id => present.has(id)), 'The selected shape is missing from the approved scene');
  return { ...scene, objects: scene.objects.filter(o => !chosen.has(o.id)) };
}

export function effectiveEmitters(scene: CatalogueScene, amplitudes: Float64Array, objects: readonly VolumeObject[]): Emitter[] {
  need(amplitudes.length === scene.owners.length, 'Owner amplitudes do not match the approved scene');
  return objects.map(object => {
    const i = scene.owners.findIndex(o => o.id === object.owner);
    need(i >= 0 && scene.owners[i]!.component === 4 && object.component === 4, 'Only real gas emitters may become a gas shape');
    const amplitude = amplitudes[i]! * (scene.ionizedGain ?? 1);
    need(Number.isFinite(amplitude) && amplitude >= 0, 'Invalid effective gas luminosity'); return { object, amplitude };
  });
}

export async function extractShapes(): Promise<ShapeSource> {
  const source = await approvedScene(), { scene } = source;
  const cloudOwner = scene.owners.find(o => o.id === 'DEM158');
  const bowl = scene.objects.find(o => o.id.endsWith('-published-bowl'));
  need(cloudOwner && bowl, 'The approved N44G cloud and published 30 Dor bowl are required');
  const selected = [
    { id: 'cloud' as const, label: 'N44G cloud', objects: scene.objects.filter(o => o.owner === cloudOwner.id) },
    { id: 'shell' as const, label: '30 Dor shell and filament complex', objects: scene.objects.filter(o => o.owner === bowl.owner) },
  ];
  const shapes: Shape[] = selected.map(s => {
    need(s.objects.length > 0 && s.objects.every(o => o.component === 4), 'Only finite gas emitters may leave the background');
    const emitters = effectiveEmitters(scene, source.amplitudes, s.objects);
    return { id: s.id, label: s.label, box: shapeBounds(s.objects), emitters };
  });
  const background = partitionEmitters(scene, shapes);
  need(background.objects.length + shapes.reduce((n, s) => n + s.emitters.length, 0) === scene.objects.length, 'The emitter partition lost light');
  need(background.dust === scene.dust && background.dustLayer === scene.dustLayer && background.oldPopulation === scene.oldPopulation && background.sources === scene.sources, 'The smooth galaxy and dust must remain untouched');
  const result = { approvedCommit: APPROVED_COMMIT, gasGain: scene.ionizedGain ?? 1, grade: source.grade, shapes };
  await mkdir(SHAPE_DIR, { recursive: true }); await writeFile(SHAPE_DIR + 'source.json', JSON.stringify(result, null, 2) + '\n');
  console.log('FINITE_SHAPES_EXTRACTED ' + JSON.stringify({ gasGain: result.gasGain, shapes: shapes.map(s => ({ id: s.id, label: s.label, primitives: s.emitters.length, box: s.box })) }));
  return result;
}

export function parseShapeSource(input: unknown): ShapeSource {
  const raw = rec(input); need(raw.approvedCommit === APPROVED_COMMIT, 'Shape source differs from the immutable approved model');
  const shapes: Shape[] = array(raw.shapes).map(value => {
    const s = rec(value), b = rec(s.box); need((s.id === 'cloud' || s.id === 'shell') && typeof s.label === 'string', 'Invalid finite shape identity');
    const box = { min: vector(b.min), max: vector(b.max) }; need(box.min.every((v, a) => v < box.max[a]!), 'Invalid finite shape bounds');
    const emitters = array(s.emitters).map(value => {
      const e = rec(value), o = rec(e.object), kind = o.kind;
      need((kind === 'ball' || kind === 'shell' || kind === 'filament') && o.component === 4 && typeof o.id === 'string' && typeof o.owner === 'string' && typeof o.source === 'string', 'Invalid emitting geometry');
      const basis = array(o.basis).map(vector); need(basis.length === 3, 'Invalid emitting basis');
      const object = volumeObject({ id: o.id, owner: o.owner, kind, component: 4, center: vector(o.center), axes: vector(o.axes), basis: [basis[0]!, basis[1]!, basis[2]!], inner: num(o.inner), color: vector(o.color), weight: num(o.weight), source: o.source, ...(o.halfSpace === undefined ? {} : { halfSpace: vector(o.halfSpace) }) });
      const amplitude = num(e.amplitude); need(amplitude >= 0, 'Negative finite emission'); return { object, amplitude };
    });
    need(emitters.length > 0, 'An emitting shape cannot be empty'); return { id: s.id, label: s.label, box, emitters };
  });
  need(shapes.length === 2 && shapes[0]!.id === 'cloud' && shapes[1]!.id === 'shell', 'The tiny pilot needs exactly one cloud and one shell');
  const ids = shapes.flatMap(s => s.emitters.map(e => e.object.id)); need(new Set(ids).size === ids.length, 'An emitter is duplicated between shapes');
  const gasGain = num(raw.gasGain); need(gasGain >= 0, 'Invalid global gas gain');
  return { approvedCommit: APPROVED_COMMIT, gasGain, grade: readGrade(raw.grade), shapes };
}
export async function readShapeSource() { return parseShapeSource(await json(SHAPE_DIR + 'source.json')); }
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await extractShapes();
