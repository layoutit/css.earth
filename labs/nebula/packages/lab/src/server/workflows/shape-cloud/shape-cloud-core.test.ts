import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';
import sharp from 'sharp';
import type { GeometryCandidate, GeometryMap } from '../../../features/observations/models/geometry-model.ts';
import type { StructureImage } from '../../../features/observations/models/structures-model.ts';
import { sha256 } from '@cssearth/core/node';
import { validatePreparedCssVolume } from '../../../adapters/renderer/volume-validation.ts';
import { initializeShapeCloud, readShapeCloudSettings } from '../../../features/shape-cloud/model.ts';
import { createShapeCloudField, createShapeImageSampler, shapePixelToUnits, shapeUnitsToPixel } from '@cssearth/bake/volume';
import { bakeShapeCloud } from './bake.ts';
import type { ShapeCloudSettings } from '../../../features/shape-cloud/types.ts';
import { shapeCloudSampling } from '../../../features/shape-cloud/quality.ts';

function candidate(id: string, radius = 50, x = 100, angle = .3): GeometryCandidate {
  return { id, center: [x, 80], radii: [radius, radius * .7], angleRadians: angle,
    score: .75, coverage: .8, supportedArcs: [{ startRadians: 0, endRadians: 4 }], groupId: 'center-1' };
}
function geometry(): GeometryMap {
  return { width: 240, height: 160, candidates: [candidate('a'), candidate('b', 54), candidate('c', 90), candidate('d', 35, 195)],
    groups: [{ id: 'center-1', center: [100, 80], members: ['a', 'b', 'c', 'd'] }] };
}
test('near duplicate boundaries seed one shell without multiplying its weight; distinct nested/off-center shapes remain', () => {
  const settings = initializeShapeCloud(geometry());
  assert.equal(settings.components.length, 3);
  const merged = settings.components.find(component => component.memberIds.length === 2)!;
  assert.deepEqual(merged.memberIds, ['a', 'b']); assert.equal(merged.weight, 1);
  assert.equal(merged.radiusX, 52); assert.equal(merged.groupId, 'center-1');
  assert.ok(settings.components.some(component => component.memberIds.length === 1 && component.memberIds[0] === 'c'));
  assert.deepEqual(initializeShapeCloud(geometry()), settings);
});
test('shape control parser rejects nonfinite values, duplicate ownership, unknown controls and out-of-range dimensions', () => {
  const original = initializeShapeCloud(geometry());
  assert.deepEqual(readShapeCloudSettings(original, 240, 160), original);
  for (const patch of [{ weight: NaN }, { depth: 0 }, { x: 481 }, { radiusY: -1 }, { brightness: 1 }]) {
    const changed = structuredClone(original); Object.assign(changed.components[0]!, patch);
    assert.throws(() => readShapeCloudSettings(changed, 240, 160));
  }
  const duplicated = structuredClone(original); duplicated.components[1]!.memberIds.push(duplicated.components[0]!.memberIds[0]!);
  assert.throws(() => readShapeCloudSettings(duplicated, 240, 160), /unique ownership/);
  assert.throws(() => readShapeCloudSettings(original, 8193, 160));
  assert.throws(() => readShapeCloudSettings({ ...original, components: Array(33).fill(original.components[0]) }, 240, 160));
});
test('raster rotations, asymmetric placement and source pixel centers share one x-right/y-up projection', () => {
  const data: GeometryMap = { width: 120, height: 80, candidates: [{ ...candidate('a'), center: [35, 21], radii: [20, 8], angleRadians: Math.PI / 4 }], groups: [] };
  const settings = initializeShapeCloud(data), field = createShapeCloudField(settings, 120, 80), out: [number, number, number] = [0, 0, 0];
  const [x, y] = shapePixelToUnits(35 + 20 / Math.sqrt(2), 21 + 20 / Math.sqrt(2), 120, 80);
  field.sampleEmission(x, y, 0, out); assert.ok(out[0] > 1);
  field.sampleEmission(x, -y, 0, out); assert.equal(out[0], 0, 'A y-handedness mutation would illuminate the mirrored point.');
  for (const pixel of [[.5, .5], [119.5, 79.5], [35, 21]]) {
    const mapped = shapePixelToUnits(pixel[0]!, pixel[1]!, 120, 80), recovered = shapeUnitsToPixel(...mapped, 120, 80);
    assert.ok(Math.abs(recovered[0] - pixel[0]!) < 1e-12 && Math.abs(recovered[1] - pixel[1]!) < 1e-12);
  }
  const rgb = Uint8Array.from({ length: 120 * 80 * 3 }, (_, index) => index % 251);
  const sampler = createShapeImageSampler(rgb, 120, 80), position = shapePixelToUnits(14.5, 23.5, 120, 80);
  assert.equal(sampler(...position, 0, out), true);
  assert.deepEqual(out, [...rgb.slice(3 * (23 * 120 + 14), 3 * (23 * 120 + 14) + 3)]);
  assert.equal(sampler(50, 50, 0, out), false);
});
test('weight, thickness, softness and depth alter the field while baking bounds retain complete emission without empty photo margins', () => {
  const data: GeometryMap = { width: 200, height: 200, candidates: [{ ...candidate('a'), center: [160, 100], radii: [55, 30], angleRadians: 0 }], groups: [] };
  const settings = initializeShapeCloud(data);
  const sample = (x: number, y: number, z: number, patch = {}) => {
    const changed = structuredClone(settings); Object.assign(changed.components[0]!, patch);
    const out: [number, number, number] = [0, 0, 0];
    createShapeCloudField(changed, 200, 200).sampleEmission(x, y, z, out); return out[0];
  };
  assert.equal(sample(5.75, 0, 0, { weight: 2 }), sample(5.75, 0, 0) * 2);
  assert.equal(sample(5.75, 0, 0, { enabled: false }), 0);
  assert.equal(sample(6.25, 0, 0), 0); assert.ok(sample(6.25, 0, 0, { thickness: .5 }) > 0);
  assert.ok(sample(6.08, 0, 0, { softness: .2 }) > sample(6.08, 0, 0));
  assert.equal(sample(3, 0, 1.5), 0); assert.ok(sample(3, 0, 1.5, { depth: 1 }) > 0);
  const field = createShapeCloudField(settings, 200, 200);
  assert.ok(field.bounds.min[0] < -.135 && field.bounds.max[0] > 6.135, 'Moved shell beyond the original image remains in the bounds.');
  assert.ok(field.bounds.min[1] < -1.71 && field.bounds.max[1] > 1.71);
  assert.ok(field.bounds.min[1] > -2 && field.bounds.max[1] < 2, 'Empty image margins must not consume finite-depth samples.');
});
test('anisotropic clouds use one physical slice spacing rather than the same slab count on each axis', () => {
  const bounds = { min: [-2, -1, -.4] as [number, number, number], max: [2, 1, .4] as [number, number, number] };
  const detail = shapeCloudSampling('detailed', bounds), draft = shapeCloudSampling('draft', bounds);
  assert.equal(detail.slices.x, 128); assert.equal(detail.slices.y, 64); assert.equal(detail.slices.z, 26);
  for (const [span, count] of [[4, detail.slices.x], [2, detail.slices.y], [.8, detail.slices.z]])
    assert.ok(Math.abs(span! / count! / detail.targetPitchUnits - 1) < .03, 'Side/front depth sampling must be comparable.');
  assert.ok(draft.slices.x < detail.slices.x && draft.width < detail.width);
});
test('3D rings keep their opening through depth; signed terms carve soft cavities without negative emission', () => {
  const settings = initializeShapeCloud({ width: 200, height: 200, groups: [], candidates: [{ ...candidate('a'), center: [100, 100], radii: [40, 30], angleRadians: 0 }] });
  const base = settings.components[0]!;
  const value = (components: ShapeCloudSettings['components'], x: number, y = 0, z = 0) => {
    const out: [number, number, number] = [0, 0, 0]; createShapeCloudField({ ...settings, components }, 200, 200).sampleEmission(x, y, z, out); return out[0];
  };
  const ring = { ...base, shape: 'ring' as const };
  for (let z = -3; z <= 3; z += .1) assert.equal(value([ring], 0, 0, z), 0, 'A ring must have an actual opening along the viewing ray.');
  assert.ok(value([ring], 2) > 0); assert.ok(value([base], 0, 0, .975) > 0, 'A shell front wall crosses that same central ray.');
  const outer = { ...base, shape: 'ellipsoid' as const };
  const cutter = { ...outer, id: 'cut', memberIds: ['cut'], operation: 'subtract' as const, radiusX: 20, radiusY: 15, depth: 2 };
  const full = value([outer], 0), faint = value([outer, { ...cutter, weight: .2 }], 0);
  assert.ok(full > faint && faint > 0, 'Partial subtraction must dim the cavity.');
  assert.equal(value([outer, cutter], 0), 0); assert.ok(value([outer, cutter], 1.5) > 0);
  assert.equal(value([cutter, outer], 0), value([outer, cutter], 0), 'Subtract after summing, not while traversing terms.');
  assert.equal(value([cutter], 0), 0); assert.equal(createShapeCloudField({ ...settings, components: [cutter] }, 200, 200).empty, true);
  assert.deepEqual(createShapeCloudField({ ...settings, components: [outer, { ...cutter, radiusX: 300 }] }, 200, 200).bounds,
    createShapeCloudField({ ...settings, components: [outer] }, 200, 200).bounds, 'Subtraction cannot enlarge the emitting support.');
  const { shape: _shape, operation: _operation, ...legacy } = base;
  assert.equal(readShapeCloudSettings({ ...settings, components: [legacy] }, 200, 200).components[0]!.shape, 'shell');
  assert.throws(() => readShapeCloudSettings({ ...settings, components: [{ ...base, shape: 'unknown' }] }, 200, 200));
  assert.throws(() => readShapeCloudSettings({ ...settings, components: [{ ...base, operation: null }] }, 200, 200));
});
test('actual XYZ bake paints the exact neutral alpha and geometry, records pins, responds to exposure and handles empty controls', async t => {
  const root = resolve('.'), directory = await mkdtemp(resolve('.local/nebula-lab/shape-core-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const width = 48, height = 40, rgb = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const at = 3 * (y * width + x); rgb[at] = x < width / 2 ? 200 : 20; rgb[at + 1] = 35; rgb[at + 2] = x < width / 2 ? 10 : 200;
  }
  const path = relative(root, resolve(directory, 'source.png'));
  await sharp(rgb, { raw: { width, height, channels: 3 } }).png().toFile(resolve(root, path));
  const source = { path, sha256: sha256(await readFile(resolve(root, path))) };
  const image: StructureImage = { id: 'fixture', label: 'Fixture', width, height, nativeWidth: width, nativeHeight: height,
    sourceSha256: '1'.repeat(64), sourceUrl: 'https://example.org/fixture.png', mapSha256: '2'.repeat(64), directory: relative(root, directory), imageToFrame: [1, 0, 0, 1, 0, 0], credit: 'Synthetic', page: 'https://example.org' };
  const map: GeometryMap = { width, height, groups: [], candidates: [{ ...candidate('a'), center: [20, 18], radii: [14, 9], angleRadians: .4 }] };
  const settings = initializeShapeCloud(map), progress: string[] = [];
  const input = { root, id: '0'.repeat(64), image, geometry: map, geometrySha256: '3'.repeat(64), settings, source,
    outputDirectory: relative(root, resolve(directory, 'bake')) };
  const result = await bakeShapeCloud(input, { onProgress: value => progress.push(value.phase) });
  assert.equal(result.empty, false); assert.ok(result.neutral && result.textured && result.projection);
  assert.ok(result.comparison); assert.equal(result.comparison.width, width); assert.equal(result.comparison.height, height);
  assert.deepEqual(result.comparison.levels.map(level => level.gain), [1, 2, 4, 8]);
  const diagnostic = result.comparison.levels[0]!.source, diagnosticBytes = await readFile(resolve(root, diagnostic.path));
  assert.equal(sha256(diagnosticBytes), diagnostic.sha256);
  const diagnosticImage = await sharp(diagnosticBytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(diagnosticImage.info.width, width); assert.equal(diagnosticImage.info.height, height);
  assert.equal(diagnosticImage.info.channels, 3);
  for (let p = 0; p < width * height; p++) {
    assert.equal(diagnosticImage.data[p * 3], diagnosticImage.data[p * 3 + 1]);
    assert.equal(diagnosticImage.data[p * 3], diagnosticImage.data[p * 3 + 2]);
  }
  assert.ok(progress.includes('volume') && progress.includes('texture') && progress.includes('compile'));
  const payload = async (pin: { path: string; sha256: string }) => {
    const bytes = await readFile(resolve(root, pin.path)); assert.equal(sha256(bytes), pin.sha256);
    return validatePreparedCssVolume(JSON.parse(bytes.toString()));
  };
  const neutral = await payload(result.neutral), textured = await payload(result.textured);
  assert.deepEqual(neutral.frame, textured.frame); assert.deepEqual(neutral.stacks, textured.stacks);
  assert.equal(neutral.id, `shape-cloud-${input.id}`);
  assert.equal(neutral.id, textured.id); assert.equal(neutral.stacks.length, 3); assert.ok(neutral.resources.length > 40);
  const p: unknown = neutral.provenance, q: unknown = textured.provenance;
  assert.ok(p && typeof p === 'object' && 'alphaSha256' in p && typeof p.alphaSha256 === 'string');
  assert.ok(q && typeof q === 'object' && 'alphaSha256' in q); assert.equal(p.alphaSha256, q.alphaSha256);
  let differentRgb = false;
  for (const resource of neutral.resources) {
    const a: Buffer = await sharp(await readFile(resolve(root, dirname(result.neutral.path), resource.path))).ensureAlpha().raw().toBuffer();
    const b: Buffer = await sharp(await readFile(resolve(root, dirname(result.textured.path), resource.path))).ensureAlpha().raw().toBuffer();
    assert.equal(a.length, b.length);
    for (let index = 0; index < a.length; index++) {
      if (index % 4 === 3) assert.equal(a[index], b[index]);
      else if (a[index] !== b[index]) differentRgb = true;
    }
  }
  assert.ok(differentRgb, 'Painting must actually change RGB, rather than return the neutral field twice.');
  const projectionBytes = await readFile(resolve(root, result.projection.path)); assert.equal(sha256(projectionBytes), result.projection.sha256);
  const projection = await sharp(projectionBytes).ensureAlpha().raw().toBuffer();
  const meanAlpha = (data: Buffer) => { let sum = 0; for (let at = 3; at < data.length; at += 4) sum += data[at]!; return sum / (data.length / 4); };
  const lower = await bakeShapeCloud({ ...input, outputDirectory: relative(root, resolve(directory, 'lower')), settings: { ...settings, exposure: .2 } });
  assert.ok(lower.projection);
  const lowProjection = await sharp(await readFile(resolve(root, lower.projection.path))).ensureAlpha().raw().toBuffer();
  assert.ok(meanAlpha(projection) > meanAlpha(lowProjection) * 2, 'Exposure must change prepared integrated emission.');
  const draft = await bakeShapeCloud({ ...input, quality: 'draft', outputDirectory: relative(root, resolve(directory, 'draft')) });
  assert.equal(draft.quality, 'draft'); assert.equal(result.quality, 'detailed');
  assert.deepEqual(draft.settings, result.settings); assert.equal(draft.unitsPerPixel, result.unitsPerPixel);
  assert.ok(draft.neutral && draft.textured && draft.projection);
  const draftNeutral = await payload(draft.neutral), draftTextured = await payload(draft.textured);
  assert.deepEqual(draftNeutral.frame, neutral.frame, 'Quality must not move or rescale the cloud.');
  assert.deepEqual(draftNeutral.stacks, draftTextured.stacks);
  assert.ok(draftNeutral.resources.length < neutral.resources.length, 'Draft must actually reduce the slice count.');
  const draftBytes = await readFile(resolve(root, draft.projection.path));
  const draftMeta = await sharp(draftBytes).metadata(), detailMeta = await sharp(projectionBytes).metadata();
  assert.ok(draftMeta.width! < detailMeta.width!, 'Draft must actually reduce texture resolution.');
  const draftProjection = await sharp(draftBytes).ensureAlpha().raw().toBuffer();
  assert.ok(Math.abs(meanAlpha(draftProjection) / meanAlpha(projection) - 1) < .04, 'Draft and refinement must keep integrated brightness close.');
  const empty = await bakeShapeCloud({ ...input, settings: { ...settings, components: settings.components.map(component => ({ ...component, enabled: false })) } });
  assert.equal(empty.empty, true); assert.equal(empty.neutral, undefined); assert.equal(empty.textured, undefined);
  assert.equal(empty.comparison?.metrics.missingFraction, 1, 'Empty previews must still expose all source signal.');
  const cancelledTerms = await bakeShapeCloud({ ...input, quality: 'draft', outputDirectory: relative(root, resolve(directory, 'subtracted')),
    settings: { ...settings, components: [settings.components[0]!, { ...settings.components[0]!, id: 'cutter', memberIds: ['cut'], operation: 'subtract' }] } });
  assert.equal(cancelledTerms.empty, true, 'Equal positive and negative volumes must produce a valid empty preview.');
  assert.equal(cancelledTerms.neutral, undefined);
  assert.equal(cancelledTerms.comparison?.metrics.missingFraction, 1);
  await assert.rejects(bakeShapeCloud(input, { signal: AbortSignal.abort() }), /cancelled/);
});
