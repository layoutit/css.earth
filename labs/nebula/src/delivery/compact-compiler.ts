/** Accepted analytic emission and component colors: no source images, fitting, or baked pixels. */
import assert from 'node:assert/strict';
import { dirname } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { validatePreparedCssVolume } from '../../../../src/renderers/css/volume/validation.js';
import { bakeCompiler, type CompilerBakeProgress } from '../reconstruction/compiler/bake.js';
import { readCompilerBakeResult, type CompilerBakeResult } from '../reconstruction/compiler/bake-types.js';
import { createEmissionField } from '../reconstruction/compiler/field.js';
import { readRetainedEmissionField } from '../reconstruction/compiler/field-model.js';
import { pinned, type Pin } from '../pipeline/io.js';

const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
interface Material { sourceId: string; components: { id: string; rgb: [number, number, number]; covered: boolean }[] }
interface Resource { path: string; sha256: string; bytes: number; width: number; height: number }
export function readCompactCompiler(value: unknown) {
  if (!record(value) || value.schema !== 'cssearth-compact-compiler@1' || !text(value.objectId) ||
      !record(value.provenance) || !digest(value.provenance.resultSha256) || !digest(value.provenance.modelSha256) ||
      !digest(value.provenance.methodSha256) || !Array.isArray(value.materials) || !Array.isArray(value.sources) || !Array.isArray(value.expected))
    throw new TypeError('Invalid compact compiler inputs.');
  const scene = readCompilerBakeResult(value.scene), field = readRetainedEmissionField(value.field);
  if (field.identity !== scene.fieldIdentity || !digest(field.identity)) throw new TypeError('Compact field identity differs.');
  const componentIds = field.components.map(component => component.id);
  if (new Set(componentIds).size !== componentIds.length) throw new TypeError('Duplicate field components.');
  const materials: Material[] = value.materials.map((material: unknown) => {
    if (!record(material) || !text(material.sourceId) || !Array.isArray(material.components) || material.components.length !== componentIds.length)
      throw new TypeError('Invalid compact material.');
    return { sourceId: material.sourceId, components: material.components.map((color: unknown, index: number) => {
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
    const resources: Resource[] = bank.resources.map((resource: unknown) => {
      if (!record(resource) || !text(resource.path) || !/^[a-z0-9/-]+\.png$/.test(resource.path) || resource.path.split('/').includes('..') ||
          !digest(resource.sha256) || typeof resource.bytes !== 'number' || !Number.isSafeInteger(resource.bytes) || resource.bytes <= 0 || typeof resource.width !== 'number' || !Number.isSafeInteger(resource.width) || resource.width <= 0 ||
          typeof resource.height !== 'number' || !Number.isSafeInteger(resource.height) || resource.height <= 0)
        throw new TypeError('Invalid expected resource.');
      return { path: resource.path, sha256: resource.sha256, bytes: resource.bytes, width: resource.width, height: resource.height };
    });
    if (new Set(resources.map(r => r.path)).size !== resources.length) throw new TypeError('Duplicate expected resource.');
    return { id: bank.id, resources };
  });
  const lensIds = scene.lenses.map(lens => lens.id);
  assert.deepEqual(materials.map(m => m.sourceId), lensIds, 'Compact materials differ from scene lenses.');
  assert.deepEqual(sources.map(s => s.id), lensIds, 'Compact sources differ from scene lenses.');
  assert.deepEqual(expected.map(b => b.id), ['neutral', ...lensIds], 'Compact expected banks differ.');
  const minimumFeatureScaleArcsec = value.minimumFeatureScaleArcsec;
  if (minimumFeatureScaleArcsec !== undefined && (typeof minimumFeatureScaleArcsec !== 'number' || !Number.isFinite(minimumFeatureScaleArcsec) || minimumFeatureScaleArcsec <= 0))
    throw new TypeError('Invalid compact feature scale.');
  return { objectId: value.objectId, field, scene, materials, sources, expected, minimumFeatureScaleArcsec };
}

export async function replayCompactCompiler(root: string, pin: Pin, outputDirectory: string,
  progress?: (progress: CompilerBakeProgress) => void) {
  const input = readCompactCompiler(JSON.parse(gunzipSync(await pinned(root, pin), { maxOutputLength: 16 * 1024 * 1024 }).toString()));
  const field = createEmissionField(input.field), old = input.scene, origin = old.coordinates.localOriginArcsec;
  const scene = await bakeCompiler({ root, outputDirectory, id: old.volumeId ?? old.id, fieldIdentity: old.fieldIdentity,
    boundsArcsec: old.boundsArcsec, skyBoundsArcsec: old.skyBoundsArcsec, minimumFeatureScaleArcsec: input.minimumFeatureScaleArcsec,
    sampleEmission: field.sampleEmission, lenses: input.materials.map((material, index) => ({ id: material.sourceId,
      label: input.sources[index]!.label, sampleMaterial: field.createMaterialSampler(material.components) })),
    stars: old.stars.map(star => ({ ...star, positionArcsec: [star.positionUnits[0] + origin[0], star.positionUnits[1] + origin[1], star.positionUnits[2] + origin[2]] })), progress });
  assert.equal(scene.alphaSha256, old.alphaSha256, 'Compact replay changed neutral opacity.');
  assert.deepEqual(scene.sampling, old.sampling, 'Compact replay changed sampling.');
  assert.equal(scene.starSprites?.atlas.sha256, old.starSprites?.atlas.sha256, 'Compact replay changed stellar sprites.');
  const banks = [{ id: 'neutral', volume: scene.neutral }, ...scene.lenses];
  for (const [index, bank] of banks.entries()) {
    const volume = validatePreparedCssVolume(JSON.parse((await pinned(root, bank.volume)).toString()));
    assert.deepEqual(volume.resources, input.expected[index]!.resources, `Compact replay changed ${bank.id} texture bytes.`);
    for (const resource of volume.resources) {
      const bytes = await pinned(root, { path: `${dirname(bank.volume.path)}/${resource.path}`, sha256: resource.sha256 });
      assert.equal(bytes.length, resource.bytes);
    }
  }
  // Preserve accepted stellar positions exactly; inverse origin arithmetic need not round-trip float bits.
  const retained: CompilerBakeResult = { ...scene, id: old.id, ...(old.volumeId ? { volumeId: old.volumeId } : {}), stars: old.stars };
  readCompilerBakeResult(retained);
  return { id: old.id, scene: retained, sources: input.sources, objectId: input.objectId, inputSha256: pin.sha256 };
}
