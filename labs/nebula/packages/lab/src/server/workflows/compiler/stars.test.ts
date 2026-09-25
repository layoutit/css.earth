import test from 'node:test';
import assert from 'node:assert/strict';
import { compilerStars, compilerStarLensPoints, createCompilerStarPhotometer, detectCompilerStarCandidates } from '@cssearth/nebula-reconstruction/stars/compiler';
import { compilerStarAppearance, validCompilerStarMaterials, validCompilerStarSize, type PreparedCompilerStar, type EmissionFieldModel } from '@cssearth/bake/volume';
import type { CompilerImage } from './images.ts';
import sharp from 'sharp';
import { detectStars } from '@cssearth/nebula-reconstruction/registration/stellar';

function image(gain = 1, scale = 1, background = 0, centers: [number, number][] = [[16.5, 16.5]]): CompilerImage {
  const width = 33, height = 33, residual = new Uint8Array(width * height * 3), original = new Uint8Array(residual.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const light = centers.reduce((sum, p) => sum + Math.floor(10 * Math.exp(-((x + .5 - p[0]) ** 2 + (y + .5 - p[1]) ** 2) / 4)), 0);
    for (let c = 0; c < 3; c++) {
      const at = (y * width + x) * 3 + c;
      residual[at] = background + gain * Math.floor(light * [1, .4, .2][c]!);
      original[at] = residual[at]! + 20;
    }
  }
  const layer = (data: Uint8Array) => ({ width, height, data, path: 'fixture', sha256: 'fixture' });
  const sampleOriginal = (x: number, y: number, out: [number, number, number]) => {
    const px = Math.floor(x / scale), py = Math.floor(-y / scale);
    if (px < 0 || py < 0 || px >= width || py >= height) return false;
    for (let c = 0; c < 3; c++) out[c] = original[(py * width + px) * 3 + c]!;
    return true;
  };
  return { id: 'fixture', label: 'fixture', credit: 'fixture', page: 'fixture', matrix: [1, 0, 0, 1, 0, 0], nativeWidth: width, nativeHeight: height,
    original: layer(original), diffuse: layer(original.map((v, i) => v - residual[i]!)), stars: layer(residual),
    pixelToSky: (x, y) => [x * scale, -y * scale], sampleOriginal, sampleRgb: sampleOriginal };
}
function energy(value: NonNullable<ReturnType<ReturnType<typeof createCompilerStarPhotometer>['measure']>>) {
  const area = Math.PI * value.diameterUnits ** 2 / 4 / value.measurement.pixelAreaUnitsSquared;
  return value.rgb.map(channel => area * value.alpha * channel / 255);
}

test('prepared star display energy matches the observed residual without opacity or color floors', () => {
  const measured = createCompilerStarPhotometer(image(), [[16.5, 16.5]]).measure(0)!;
  assert.ok(measured.alpha < .18, 'a faint source must remain fainter than the old 18% opacity floor');
  assert.ok(measured.rgb[2] < measured.rgb[0] * .25, 'red stars must not acquire a white color floor');
  const predicted = energy(measured), target = measured.measurement.residualDisplayEnergyRgb;
  for (let c = 0; c < 3; c++) {
    assert.ok(predicted[c]! <= target[c]! + 1e-12);
    assert.ok(target[c]! - predicted[c]! <= Math.max(...target) / 255 + 1e-12);
    assert.ok(target[c]! <= measured.measurement.originalDisplayEnergyRgb[c]!);
  }
});

test('source intensity and angular image scale independently control light and footprint', () => {
  const a = createCompilerStarPhotometer(image(1), [[16.5, 16.5]]).measure(0)!;
  const b = createCompilerStarPhotometer(image(2), [[16.5, 16.5]]).measure(0)!;
  const wide = createCompilerStarPhotometer(image(1, 2), [[16.5, 16.5]]).measure(0)!;
  assert.equal(b.alpha, a.alpha * 2);
  assert.ok(Math.abs(b.diameterUnits - a.diameterUnits) < 1e-12);
  assert.ok(Math.abs(wide.diameterUnits - a.diameterUnits * 2) < 1e-12);
  assert.deepEqual(energy(wide), energy(a));
});

test('local smooth residual background is excluded and neighboring apertures do not claim the same pixels', () => {
  const a = createCompilerStarPhotometer(image(), [[16.5, 16.5]]).measure(0)!;
  const background = createCompilerStarPhotometer(image(1, 1, 30), [[16.5, 16.5]]).measure(0)!;
  assert.deepEqual(background.measurement.residualDisplayEnergyRgb, a.measurement.residualDisplayEnergyRgb);
  const points: [number, number][] = [[14.5, 16.5], [18.5, 16.5]], pair = image(1, 1, 0, points);
  const owned = createCompilerStarPhotometer(pair, points);
  const separate = points.map(point => createCompilerStarPhotometer(pair, [point]).measure(0)!);
  const jointSum = energy(owned.measure(0)!)[0]! + energy(owned.measure(1)!)[0]!;
  const duplicated = energy(separate[0]!)[0]! + energy(separate[1]!)[0]!;
  const observed = pair.stars.data.reduce((sum, v, i) => sum + (i % 3 === 0 ? v / 255 : 0), 0);
  assert.ok(jointSum <= observed + 1e-12);
  assert.ok(duplicated > jointSum * 1.5);
});

test('new angular footprints and historical screen footprints stay unambiguous', () => {
  assert.equal(validCompilerStarSize({ diameterUnits: .1 }), true);
  assert.equal(validCompilerStarSize({ widthPx: 2 }), true);
  assert.equal(validCompilerStarSize({ diameterUnits: .1, widthPx: 2 }), false);
  assert.equal(validCompilerStarSize({ diameterUnits: 0 }), false);
  assert.equal(validCompilerStarSize({}), false);
});

test('registered infrared photometry changes appearance while the reference catalogue and XYZ remain fixed', async () => {
  const reference = { ...image(8, 1, 0, [[10.5, 16.5]]), id: 'optical' };
  const rotated = image(4, 1, 0, [[16.5, 22.5]]), originalSample = rotated.sampleOriginal;
  const infrared: CompilerImage = { ...rotated, id: 'infrared', pixelToSky: (x, y) => [33 - y, -x],
    sampleOriginal: (x, y, out) => originalSample(-y, x - 33, out) };
  const missing: CompilerImage = { ...infrared, id: 'unobserved', pixelToSky: (x, y) => [1000 + x, 1000 - y] };
  assert.deepEqual(compilerStarLensPoints(reference, infrared, [[10.5, 16.5]]), [[16.5, 22.5]]);
  const field: EmissionFieldModel = { schema: 'cssearth-conditional-emission-field@1', identity: 'fixture', controls: { detail: 1, faint: 1, depth: 1 },
    bounds: { min: [-100, -100, -100], max: [100, 100, 100] }, skyBounds: { min: [-100, -100], max: [100, 100] }, scaffold: null,
    components: [{ id: 'cloud', basisId: 'cloud', center: [10.5, -16.5, 0], sigma: [20, 20, 20], angleRadians: 0,
      projectedWeight: 1, depthAssignment: 'halo-diffuse', velocityCovered: false }],
    assumptions: { kernel: 'fixture', projectionUnits: 'fixture', depth: 'fixture', halo: 'fixture', haloRadiusArcsec: 100,
      equalNearFarSplit: true, velocityUncoveredComponents: 1 } };
  const baseline = await compilerStars(reference, field, 10), combined = await compilerStars(reference, field, 10, [reference, infrared, missing]);
  assert.ok(combined.length > 0);
  assert.deepEqual(combined.map(s => [s.id, s.positionArcsec]), baseline.map(s => [s.id, s.positionArcsec]));
  for (const star of combined) {
    assert.equal(star.materials!.infrared!.alpha, star.materials!.optical!.alpha / 2);
    assert.ok(Math.abs(star.materials!.infrared!.diameterUnits - star.materials!.optical!.diameterUnits) < 1e-10);
    assert.equal(star.materials!.unobserved!.alpha, 0);
    const prepared: PreparedCompilerStar = { ...star, positionUnits: star.positionArcsec }, original = structuredClone(prepared);
    assert.deepEqual(compilerStarAppearance(prepared, 'infrared'), star.materials!.infrared);
    assert.deepEqual(compilerStarAppearance(prepared, 'optical'), star.materials!.optical);
    assert.equal(compilerStarAppearance(prepared, null), prepared);
    assert.deepEqual(prepared, original);
  }
});

test('lens materials require complete known coverage and cannot carry geometry; historical stars remain readable', () => {
  const ids = new Set(['optical', 'infrared']), appearance = { rgb: [255, 100, 30], alpha: .2, diameterUnits: 10 };
  assert.equal(validCompilerStarMaterials(undefined, ids), true);
  assert.equal(validCompilerStarMaterials({ optical: appearance, infrared: { ...appearance, alpha: 0 } }, ids), true);
  assert.equal(validCompilerStarMaterials({ optical: appearance }, ids), false);
  assert.equal(validCompilerStarMaterials({ optical: appearance, invented: appearance }, ids), false);
  assert.equal(validCompilerStarMaterials({ optical: appearance, infrared: { ...appearance, positionUnits: [1, 2, 3] } }, ids), false);
  assert.equal(validCompilerStarMaterials({ optical: appearance, infrared: { ...appearance, alpha: 2 } }, ids), false);
  const historical: PreparedCompilerStar = { id: 'legacy', positionUnits: [1, 2, 3], rgb: [255, 255, 255], alpha: .2, widthPx: 1 };
  assert.equal(compilerStarAppearance(historical, 'infrared'), historical);
});

function selectionField(weight = 1): EmissionFieldModel {
  return { schema: 'cssearth-conditional-emission-field@1', identity: 'selection-fixture', controls: { detail: 1, faint: 1, depth: 1 },
    bounds: { min: [-100, -100, -100], max: [100, 100, 100] }, skyBounds: { min: [-100, -100], max: [100, 100] }, scaffold: null,
    components: [{ id: 'cloud', basisId: 'cloud', center: [16.5, -16.5, 0], sigma: [20, 20, 20], angleRadians: 0,
      projectedWeight: weight, depthAssignment: 'halo-diffuse', velocityCovered: false }],
    assumptions: { kernel: 'fixture', projectionUnits: 'fixture', depth: 'fixture', halo: 'fixture', haloRadiusArcsec: 100,
      equalNearFarSplit: true, velocityUncoveredComponents: 1 } };
}

test('the bounded catalogue favors broad bright residual energy over sharper faint peaks without changing stellar light or depth', async () => {
  const source = image(), layer = source.stars;
  for (let y = 0; y < layer.height; y++) for (let x = 0; x < layer.width; x++) {
    // Isolated narrow source: higher detector peak, much lower integrated light.
    const narrow = 180 * Math.exp(-((x - 8) ** 2 + (y - 16) ** 2) / .8);
    const broad = 90 * Math.exp(-((x - 24) ** 2 + (y - 16) ** 2) / 10);
    for (let c = 0; c < 3; c++) {
      const p = (y * layer.width + x) * 3 + c;
      layer.data[p] = Math.round(narrow + broad); source.original.data[p] = layer.data[p]!;
    }
  }
  const bytes = await sharp(layer.data, { raw: { width: layer.width, height: layer.height, channels: 3 } }).png().toBuffer();
  const detected = await detectStars(bytes, [source.nativeWidth, source.nativeHeight]);
  assert.equal(detected.length, 2); assert.ok(detected[0]!.point[0] < 12, 'The detector must rank the sharper faint source first');
  const photometer = createCompilerStarPhotometer(source, detected.map(star => star.point));
  const bright = photometer.measure(1)!, faint = photometer.measure(0)!;
  assert.ok(energy(bright)[0]! > energy(faint)[0]! * 3);
  const complete = await compilerStars(source, selectionField(), 2);
  const selected = await compilerStars(source, selectionField(), 1);
  assert.equal(selected.length, 1); assert.equal(selected[0]!.id, 'fixture-1');
  assert.deepEqual(selected[0], complete.find(star => star.id === 'fixture-1'), 'The budget cannot change coordinates, depths, materials or measured appearance');
  assert.equal(selected[0]!.alpha, bright.alpha); assert.equal(selected[0]!.diameterUnits, bright.diameterUnits);
  assert.deepEqual(selected[0]!.rgb, bright.rgb);
});

test('equal measured light keeps stable source identity order and weak positive columns retain field lights while zero columns do not', async () => {
  const source = image(8, 1, 0, [[8.5, 16.5], [24.5, 16.5]]);
  const full = await compilerStars(source, selectionField(), 2);
  assert.deepEqual(full.map(star => star.id), ['fixture-0', 'fixture-1']);
  const weak = await compilerStars(source, selectionField(.001), 2);
  assert.deepEqual(weak, full, 'Scaling a positive depth distribution must not select or dim observed field stars');
  assert.deepEqual(await compilerStars(source, selectionField(0), 2), [], 'No depth may be invented without positive field support');
  assert.deepEqual(await compilerStars(source, selectionField(), 1), full.slice(0, 1));
});

test('more than 6000 sharper faint peaks cannot preempt a bright broad star before aperture ranking', async () => {
  const width = 1000, height = 1000, data = new Uint8Array(width * height * 3);
  function add(cx: number, cy: number, peak: number, variance: number) {
    for (let y = Math.max(0, cy - 10); y <= Math.min(height - 1, cy + 10); y++)
      for (let x = Math.max(0, cx - 10); x <= Math.min(width - 1, cx + 10); x++) {
        const value = Math.round(peak * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / variance));
        for (let c = 0; c < 3; c++) data[(y * width + x) * 3 + c] += value;
      }
  }
  for (let y = 0; y < 80; y++) for (let x = 0; x < 81; x++) add(8 + x * 12, 8 + y * 12, 180, .8);
  add(500, 985, 90, 10);
  const layer = { width, height, data, path: 'fixture', sha256: 'fixture' };
  const sample = (x: number, y: number, out: [number, number, number]) => {
    const px = Math.floor(x), py = Math.floor(-y);
    if (px < 0 || py < 0 || px >= width || py >= height) return false;
    for (let c = 0; c < 3; c++) out[c] = data[(py * width + px) * 3 + c]!; return true;
  };
  const source: CompilerImage = { ...image(), nativeWidth: width, nativeHeight: height, original: layer, diffuse: layer, stars: layer,
    sampleOriginal: sample, sampleRgb: sample };
  const bytes = await sharp(data, { raw: { width, height, channels: 3 } }).png().toBuffer();
  const truncated = await detectStars(bytes, [width, height]);
  assert.equal(truncated.length, 6000); assert.ok(truncated.every(star => star.point[1] < 970), 'Fixture must expose the old detector quota.');
  const complete = await detectCompilerStarCandidates(source);
  assert.equal(complete.length, 6481);
  const model = selectionField(); model.bounds = { min: [0, -1000, -100], max: [1000, 0, 100] };
  model.components[0] = { ...model.components[0]!, center: [500, -500, 0], sigma: [1000, 1000, 20] };
  const selected = await compilerStars(source, model, 1);
  assert.equal(selected.length, 1); assert.ok(Math.abs(selected[0]!.positionArcsec[0] - 500.5) < .1);
  assert.ok(Math.abs(selected[0]!.positionArcsec[1] + 985.5) < .1, 'The observed broad bright star must win the unchanged one-star budget.');
});
