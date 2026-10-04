import { readCompilerBakeResult } from '../compiler/compiler-bake.js';
import { readEnvelopeColors, type EnvelopeColors } from '../emission/photometric-emission.js';
import { readRetainedEmissionField } from '../emission/retained-emission.js';
export const COMPACT_COMPILER_SCHEMA = 'cssearth-compact-compiler@1';
const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i]);

const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
export interface CompactCompilerMaterial { sourceId: string; envelopeColors?: EnvelopeColors; components: { id: string; rgb: [number, number, number]; covered: boolean }[] }
export interface CompactCompilerResource { path: string; bytes: number; width: number; height: number }
export function readCompactCompiler(value: unknown) {
  if (!record(value) || value.schema !== COMPACT_COMPILER_SCHEMA || !text(value.objectId) ||
      !record(value.provenance) || !Array.isArray(value.materials) || !Array.isArray(value.sources) || !Array.isArray(value.expected))
    throw new TypeError('Invalid compact compiler inputs.');
  const scene = readCompilerBakeResult(value.scene), field = readRetainedEmissionField(value.field);
  if (field.identity !== scene.fieldIdentity) throw new TypeError(`Compact field ${field.identity} differs from the scene's field ${scene.fieldIdentity}.`);
  const componentIds = field.components.map(component => component.id);
  if (new Set(componentIds).size !== componentIds.length) throw new TypeError('Duplicate field components.');
  const materials: CompactCompilerMaterial[] = value.materials.map((material: unknown) => {
    if (!record(material) || !text(material.sourceId) || !Array.isArray(material.components) || material.components.length !== componentIds.length)
      throw new TypeError('Invalid compact material.');
    const envelopeColors = field.photometricEnvelope ? readEnvelopeColors(material.envelopeColors, field.photometricEnvelope) : undefined;
    if (!field.photometricEnvelope && material.envelopeColors !== undefined) throw new TypeError('Envelope material has no retained density.');
    return { sourceId: material.sourceId, ...(envelopeColors ? { envelopeColors } : {}), components: material.components.map((color: unknown, index: number) => {
      if (!record(color) || color.id !== componentIds[index] || typeof color.covered !== 'boolean' || !Array.isArray(color.rgb) ||
          color.rgb.length !== 3 || !color.rgb.every((n): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 255))
        throw new TypeError('Compact material component differs.');
      return { id: componentIds[index]!, covered: color.covered, rgb: [color.rgb[0]!, color.rgb[1]!, color.rgb[2]!] };
    }) };
  });
  const sources = value.sources.map((source: unknown) => {
    if (!record(source) || !text(source.id) || !text(source.label) || !text(source.credit) || !text(source.page) || !source.page.startsWith('https://'))
      throw new TypeError('Invalid compact source.');
    return { id: source.id, label: source.label, credit: source.credit, page: source.page };
  });
  const expected = value.expected.map((bank: unknown) => {
    if (!record(bank) || !text(bank.id) || !Array.isArray(bank.resources)) throw new TypeError('Invalid expected bank.');
    const resources: CompactCompilerResource[] = bank.resources.map((resource: unknown) => {
      if (!record(resource) || !text(resource.path) || !/^[a-z0-9/-]+\.png$/.test(resource.path) || resource.path.split('/').includes('..') ||
          typeof resource.bytes !== 'number' || !Number.isSafeInteger(resource.bytes) || resource.bytes <= 0 || typeof resource.width !== 'number' || !Number.isSafeInteger(resource.width) || resource.width <= 0 ||
          typeof resource.height !== 'number' || !Number.isSafeInteger(resource.height) || resource.height <= 0)
        throw new TypeError('Invalid expected resource.');
      return { path: resource.path, bytes: resource.bytes, width: resource.width, height: resource.height };
    });
    if (new Set(resources.map(r => r.path)).size !== resources.length) throw new TypeError('Duplicate expected resource.');
    return { id: bank.id, resources };
  });
  const datasetIds = scene.datasets.map(dataset => dataset.id);
  if (!sameIds(materials.map(m => m.sourceId), datasetIds)) throw new TypeError('Compact materials differ from scene datasets.');
  if (!sameIds(sources.map(s => s.id), datasetIds)) throw new TypeError('Compact sources differ from scene datasets.');
  if (!sameIds(expected.map(b => b.id), ['neutral', ...datasetIds])) throw new TypeError('Compact expected banks differ.');
  const minimumFeatureScaleArcsec = value.minimumFeatureScaleArcsec;
  if (minimumFeatureScaleArcsec !== undefined && (typeof minimumFeatureScaleArcsec !== 'number' || !Number.isFinite(minimumFeatureScaleArcsec) || minimumFeatureScaleArcsec <= 0))
    throw new TypeError('Invalid compact feature scale.');
  return { objectId: value.objectId, field, scene, materials, sources, expected, minimumFeatureScaleArcsec };
}
