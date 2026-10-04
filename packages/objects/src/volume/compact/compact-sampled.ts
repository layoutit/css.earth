import { readSampledRecipe } from '../emission/sampled-recipe.js';
import { readCompilerBakeResult, type CompilerPin } from '../compiler/compiler-bake.js';
export const COMPACT_SAMPLED_SCHEMA = 'cssearth-compact-sampled@2';
export interface CompactSampledColor { rgb: [number, number, number]; covered: boolean }
const jointRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const object = (v: unknown): Record<string, unknown> => {
  if (!jointRecord(v)) throw new Error("Invalid compact record");
  return v;
};
const text = (v: unknown): string => {
  if (typeof v !== "string") throw new Error("Invalid compact string");
  return v;
};
const finite = (v: unknown): number => {
  if (typeof v !== "number" || !Number.isFinite(v))
    throw new Error("Invalid compact number");
  return v;
};
const array = (v: unknown): unknown[] => {
  if (!Array.isArray(v)) throw new Error("Invalid compact list");
  return v;
};
const triple = (v: unknown): [number, number, number] => {
  const a = array(v).map(finite);
  if (a.length !== 3) throw new Error("Invalid vector");
  return [a[0]!, a[1]!, a[2]!];
};
const pin = (v: unknown): CompilerPin => {
  const p = object(v);
  return { path: text(p.path) };
};
function readCompactSampledColors(v: unknown): CompactSampledColor[] {
  return array(v).map((c) => {
    const r = object(c),
      rgb = triple(r.rgb);
    if (typeof r.covered !== "boolean" || rgb.some((n) => n < 0 || n > 1))
      throw new Error("Invalid material color");
    return { rgb, covered: r.covered };
  });
}

export function readCompactSampled(value: unknown) {
  const m = object(value);
  if (m.schema !== COMPACT_SAMPLED_SCHEMA) throw new Error("Invalid compact sampled model");
  const recipe = readSampledRecipe(m.recipe), original = readCompilerBakeResult(m.scene), id = text(m.sourceResult);
  if (id !== original.id) throw new TypeError('Compact source result differs from its retained scene.');
  const datasets = array(m.datasets).map(readCompactSampledDataset);
  const ids = datasets.map(dataset => dataset.id);
  if (new Set(ids).size !== ids.length || ids.length !== original.datasets.length || original.datasets.some(dataset => !ids.includes(dataset.id)))
    throw new TypeError('Compact datasets differ from the retained scene.');
  if (Object.hasOwn(m, 'expected')) throw new TypeError(`Compact sampled inputs for ${id} carry the removed volume digest field expected.`);
  return { id, recipe, original, particles: pin(m.particles), datasets };
}
function readCompactSampledDataset(value: unknown) {
  const l = object(value), material = object(l.material), f = l.fit === undefined ? undefined : object(l.fit);
  const fit = f === undefined ? undefined : { atoms: array(f.atoms).map(a => {
    const r = object(a), sigmaArcsec = finite(r.sigmaArcsec);
    if (sigmaArcsec <= 0) throw new Error("Invalid atom");
    return { centerArcsec: triple(r.centerArcsec), sigmaArcsec };
  }), coefficients: array(f.coefficients).map(finite), ejectaGain: finite(f.ejectaGain) };
  return { id: text(l.id), label: text(l.label), credit: text(l.credit), page: text(l.page), points: pin(l.points), fit,
    material: { windColors: readCompactSampledColors(material.windColors), diffuseColors: readCompactSampledColors(material.diffuseColors) } };
}
export function decodeCompactPointColors(bytes: Uint8Array, height: number): Float64Array {
  if (bytes.byteLength !== height * 32) throw new Error("Point colors size differs");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), colors = new Float64Array(height * 4);
  for (let i = 0; i < colors.length; i++) {
    colors[i] = view.getFloat64(i * 8, true);
    if (!Number.isFinite(colors[i]) || colors[i]! < 0 || colors[i]! > 1 || (i % 4 === 3 && colors[i] !== 0 && colors[i] !== 1)) throw new Error("Invalid point color");
  }
  return colors;
}

/** Preserve the compact writer's little-endian IEEE-754 doubles, including their exact bit values. */
export function encodeCompactPointColors(colors: Float64Array): Uint8Array {
  const bytes = new Uint8Array(colors.length * 8), view = new DataView(bytes.buffer);
  for (let i = 0; i < colors.length; i++) view.setFloat64(i * 8, colors[i]!, true);
  return bytes;
}
