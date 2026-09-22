/**
 * Offline replay of an accepted simulation-guided finite-emission delivery.
 *
 * The fitted emission field, its envelope gain map, the neutral alpha bank and the pinned depth density
 * are delivered inputs, so no fit, star removal or registration runs here. Per lens this repeats the
 * accepted material arithmetic exactly: bilinear registered colour inside the coverage mask, component
 * plus envelope emission through the same perspective transform, and the same alpha-limited slab
 * material recolouring the same neutral textures at the same encoder settings.
 */
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { createEmissionField } from '@cssearth/volume-core/fields/emission';
import { createEmissionMaterial } from '@cssearth/volume-core/materials/component-material';
import { compilerSlabMaterial, lensChannelGainMaterial, validateChannelGain, validateLensToneCurve, type LensTone } from '@cssearth/volume-core/materials/slab-material';
import { createEnvelopeSampler, envelopeChromaticity, envelopeChromaSettings, validateEnvelopeSettings } from '@cssearth/volume-core/fields/simulation-envelope';
import { physicalToField, angularScale } from '@cssearth/volume-core/coordinates/observer-tangent';
import { parseCloudAppearance } from '@cssearth/volume-core/materials/cloud-appearance';
import { record } from '@cssearth/volume-core/contracts/volume-recipe';
import type { EmissionFieldModel } from '@cssearth/volume-core/contracts/emission';
import type { VolumeSlices } from '@cssearth/volume-core/contracts/volume-slices';
import type { Vector3 } from '@cssearth/volume-core/contracts/volume-recipe';
import { recolorCloudSlices } from '../slices/material.ts';
import { loadSimulationPrior } from './simulation-prior.ts';
import { localPath, pinned, type Pin } from './io.ts';
import { containedPath } from './density-grid.ts';

export const COMPACT_FINITE_EMISSION_SCHEMA = 'cssearth-compact-finite-emission@1';

const parsePin = (value: unknown, label: string): Pin => {
  const pin = record(value, label);
  assert.ok(typeof pin.path === 'string', `${label} needs a path`);
  return { path: pin.path };
};
const numbers = (value: unknown, length: number, label: string): number[] => {
  assert.ok(Array.isArray(value) && value.length === length && value.every(entry => typeof entry === 'number' && Number.isFinite(entry)), `Invalid ${label}`);
  return value as number[];
};
function bounds2(value: unknown, label: string) {
  const raw = record(value, label);
  const min = numbers(raw.min, 2, `${label} minimum`), max = numbers(raw.max, 2, `${label} maximum`);
  assert.ok(min[0]! < max[0]! && min[1]! < max[1]!, `Invalid ${label}`);
  return { min: [min[0]!, min[1]!] as [number, number], max: [max[0]!, max[1]!] as [number, number] };
}
/** Delivered JSON is gzipped; its digest covers the compressed bytes actually checked in. */
async function json(root: string, pin: Pin): Promise<unknown> {
  const bytes = await pinned(root, pin);
  return JSON.parse((pin.path.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString('utf8'));
}

export interface CompactFiniteLens {
  imageId: string;
  /** Directory of regenerated material textures, matching the accepted delivery layout. */
  directory: string;
  /** Painted slice bank, ready for the host's volume compiler. */
  slices: VolumeSlices;
  coverage: { positiveAlphaTexels: number; recoloredTexels: number };
}

/**
 * Regenerate every lens of one delivered finite-emission model into `destination/<imageId>`.
 * Returns the painted banks; the delivery owner compiles, packs and verifies them.
 */
export async function restoreCompactFiniteEmission(root: string, inputPin: Pin, destination: string): Promise<CompactFiniteLens[]> {
  const input = record(await json(root, inputPin), 'compact finite emission');
  assert.equal(input.schema, COMPACT_FINITE_EMISSION_SCHEMA);
  assert.equal(input.method, 'simulation-guided-finite-material@1');
  const geometry = record(input.geometry, 'delivered geometry');
  const distance = geometry.observerDistanceKpc;
  assert.ok(typeof distance === 'number' && Number.isFinite(distance) && distance > 0, 'Delivered observer distance must be positive kpc.');
  const modelTangent = bounds2(geometry.tangentBoundsKpc, 'model tangent bounds');
  const material = record(input.material, 'delivered material settings');
  const exposureGain = material.exposureGain, fullChromaAlphaByte = material.fullChromaAlphaByte;
  assert.ok(typeof exposureGain === 'number' && exposureGain > 0, 'Delivered exposure gain must be positive.');
  assert.ok(typeof fullChromaAlphaByte === 'number' && fullChromaAlphaByte >= 1 && fullChromaAlphaByte <= 255, 'Delivered chroma alpha limit must be a byte.');
  const appearance = parseCloudAppearance(input.appearance);
  assert.equal(appearance.detailStrength, 0, 'Finite component material does not support projected detail enhancement');
  const encoding = record(input.encoding, 'delivered encoding');
  assert.equal(encoding.format, 'webp');
  assert.ok(typeof encoding.quality === 'number' && Number.isInteger(encoding.quality), 'Delivered encoder quality must be an integer.');

  const field = await json(root, parsePin(input.emissionField, 'emission field')) as EmissionFieldModel;
  const preparedField = createEmissionField(field);
  const slices = await json(root, parsePin(input.neutralSlices, 'neutral slices')) as VolumeSlices;
  const neutralDirectory = localPath(root, (() => {
    const value = input.neutralTextures;
    assert.ok(typeof value === 'string' && value.length > 0, 'Delivered neutral texture directory is missing.');
    return value;
  })());
  const A = angularScale(distance);

  // The envelope names the density it was fitted with. A delivered copy keeps the accepted identity, so
  // the sampler still refuses a prior the accepted envelope was not fitted against.
  const envelopeRecord = record(await json(root, parsePin(input.envelope, 'envelope')), 'envelope record');
  assert.equal(envelopeRecord.schema, 'cssearth-simulation-envelope@1');
  const settings = validateEnvelopeSettings(envelopeRecord.settings), chroma = envelopeChromaSettings(settings);
  const gw = envelopeRecord.width, gh = envelopeRecord.height;
  assert.ok(Number.isInteger(gw) && Number.isInteger(gh), 'Envelope grid must be integral.');
  const gain = envelopeRecord.gain;
  assert.ok(Array.isArray(gain) && gain.length === Number(gw) * Number(gh) &&
    gain.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0), 'Invalid simulation envelope record');
  const prior = record(input.priorCloud, 'prior cloud');
  const readPin = parsePin(prior.recipe, 'prior recipe'), identityPin = parsePin(prior.identityPin, 'prior identity');
  const depthPrior = await loadSimulationPrior(root, readPin, distance, modelTangent, { identityPin });
  assert.equal(depthPrior.identity, envelopeRecord.priorIdentity, 'Depth density differs from the prior this envelope was fitted with.');
  const zRange = numbers(envelopeRecord.zRange, 2, 'envelope depth range');
  const envelopeGrid = { width: Number(gw), height: Number(gh), bounds: bounds2(envelopeRecord.bounds, 'envelope bounds'),
    zRange: [zRange[0]!, zRange[1]!] as [number, number], gain: Float32Array.from(gain as number[]) };
  const envelopeAt = createEnvelopeSampler(envelopeGrid, depthPrior);

  const lenses = input.lenses;
  assert.ok(Array.isArray(lenses) && lenses.length > 0, 'A delivered finite model has at least one lens.');
  // A lens tone curve is indexed by the model's own front-projection byte at the texel's sky position, read
  // from the delivered projection exactly as the accepted bake read the model's `fit-projection.png`.
  const levelAt = input.toneProjection === undefined ? null : await (async () => {
    const grid = record(input.toneProjection, 'delivered tone projection');
    const pw = grid.width, ph = grid.height;
    assert.ok(Number.isInteger(pw) && Number.isInteger(ph) && Number(pw) > 0 && Number(ph) > 0, 'A tone projection needs its pinned grid.');
    const pb = bounds2(grid.tangentBoundsKpc, 'tone projection bounds'), w = Number(pw), h = Number(ph);
    const projection = await sharp(await pinned(root, parsePin(grid.image, 'tone projection image'))).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.ok(projection.info.width === w && projection.info.height === h, 'Front projection differs from its pinned grid.');
    const pc = projection.info.channels, pd = projection.data;
    const at = (i: number, j: number) => pd[(Math.min(h - 1, Math.max(0, j)) * w + Math.min(w - 1, Math.max(0, i))) * pc]!;
    return (x: number, y: number, z: number) => {
      const p = physicalToField([x, y, z], distance), u = (p[0] / A - pb.min[0]) / (pb.max[0] - pb.min[0]) * w - .5,
        v = (pb.max[1] - p[1] / A) / (pb.max[1] - pb.min[1]) * h - .5;
      if (u < -.5 || v < -.5 || u > w - .5 || v > h - .5) return 0;
      const i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
      return at(i, j) * (1 - fu) * (1 - fv) + at(i + 1, j) * fu * (1 - fv) + at(i, j + 1) * (1 - fu) * fv + at(i + 1, j + 1) * fu * fv;
    };
  })();
  const seen = new Set<string>(), results: CompactFiniteLens[] = [];
  for (const value of lenses as unknown[]) {
    const lens = record(value, 'delivered lens');
    const imageId = lens.imageId;
    assert.ok(typeof imageId === 'string' && /^[a-z][a-z0-9-]*$/.test(imageId), 'Invalid delivered lens id.');
    assert.ok(!seen.has(imageId), 'Duplicate delivered lens.'); seen.add(imageId);
    const filter = record(lens.densityFilter, 'delivered density filter');
    assert.deepEqual({ cutoff: filter.cutoff, softness: filter.softness, showRemoved: filter.showRemoved },
      { cutoff: 0, softness: .25, showRemoved: false }, 'Compact replay requires the accepted unchanged density filter.');
    const sourceDigest = lens.sourceDigest;
    assert.ok(typeof sourceDigest === 'string' && /^[a-f0-9]{64}$/.test(sourceDigest), 'A delivered lens names its registered source digest.');
    const bounds = bounds2(lens.tangentBoundsKpc, `${imageId} tangent bounds`);

    const registered = await pinned(root, parsePin(lens.registered, `${imageId} registered image`));
    const decoded = await sharp(registered).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width, height } = decoded.info, rgb = decoded.data;
    // Only this mask's alpha is read, at the registered resolution and again at envelope scale, exactly
    // as the accepted bake read the registered original's alpha.
    const maskBytes = await pinned(root, parsePin(lens.coverage, `${imageId} coverage mask`));
    const coverage = await sharp(maskBytes).resize(width, height, { fit: 'fill' }).ensureAlpha().raw().toBuffer();

    const lensMaterial = createEmissionMaterial(field, { id: sourceDigest, sampleRgb(x, y, out) {
      const tx = x / A, ty = y / A, u = (tx - bounds.min[0]) / (bounds.max[0] - bounds.min[0]) * width - .5,
        v = (bounds.max[1] - ty) / (bounds.max[1] - bounds.min[1]) * height - .5;
      if (u < 0 || v < 0 || u > width - 1 || v > height - 1) return false;
      const ix = Math.floor(u), iy = Math.floor(v);
      if (coverage[(iy * width + ix) * 4 + 3]! < 250) return false;
      for (let c = 0; c < 3; c++) {
        let value = 0;
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++)
          value += rgb[3 * (Math.min(height - 1, iy + dy) * width + Math.min(width - 1, ix + dx)) + c]! * (dx ? u - ix : 1 - u + ix) * (dy ? v - iy : 1 - v + iy);
        // The four weights sum to one, so the result is inside the byte range; floating error can leave it a hair outside.
        out[c] = Math.min(255, Math.max(0, value));
      }
      return true;
    } }, preparedField);

    const lensRgb = await sharp(registered).resize(envelopeGrid.width, envelopeGrid.height, { fit: 'fill' }).removeAlpha().raw().toBuffer();
    const lensAlpha = await sharp(maskBytes).resize(envelopeGrid.width, envelopeGrid.height, { fit: 'fill' }).ensureAlpha().raw().toBuffer();
    const lensCoverage = Uint8Array.from({ length: envelopeGrid.width * envelopeGrid.height }, (_, p) => lensAlpha[p * 4 + 3]! >= 250 ? 1 : 0);
    const envelopeColor = envelopeChromaticity(lensRgb, lensCoverage, envelopeGrid.width, envelopeGrid.height, envelopeGrid.bounds, settings.scalePixels, chroma.halfSaturationQuantile, chroma.skyQuantile, chroma.coverageTaper);

    const sampleEmission = (x: number, y: number, z: number, out: Vector3) => {
      const p = physicalToField([x, y, z], distance);
      preparedField.sampleEmission(p[0], p[1], p[2], out);
      const e = envelopeAt(p[0], p[1], p[2]);
      for (let c = 0; c < 3; c++) out[c] = (out[c]! + e) * A;
    };
    const componentLight: Vector3 = [0, 0, 0], componentColor: Vector3 = [0, 0, 0], envelopeRgb: Vector3 = [0, 0, 0];
    const sampleMaterial = (x: number, y: number, z: number, out: Vector3) => {
      const p = physicalToField([x, y, z], distance);
      preparedField.sampleEmission(p[0], p[1], p[2], componentLight);
      const ce = componentLight[0], ee = envelopeAt(p[0], p[1], p[2]);
      const hasComponent = ce > 0 && lensMaterial.sampleMaterial(p[0], p[1], p[2], componentColor);
      const hasEnvelope = ee > 0 && envelopeColor(p[0], p[1], envelopeRgb);
      const cw = hasComponent ? ce : 0, ew = hasEnvelope ? ee : 0;
      if (!(cw + ew > 0)) return false;
      for (let c = 0; c < 3; c++) out[c] = Math.min(255, Math.max(0, (cw * componentColor[c]! + ew * envelopeRgb[c]!) / (cw + ew)));
      return true;
    };
    // A delivered lens may carry its own per-channel display correction and fitted tone curve against its own
    // source image; both straddle the alpha chroma limit exactly as the accepted bake applies them.
    let tone: LensTone | null = null;
    if (lens.toneCurve !== undefined) {
      assert.ok(levelAt, `${imageId} carries a tone curve but the delivery has no tone projection.`);
      tone = { curve: validateLensToneCurve(lens.toneCurve), levelAt };
    }
    const slabMaterial = lensChannelGainMaterial(compilerSlabMaterial(sampleEmission, sampleMaterial), sampleEmission,
      exposureGain, fullChromaAlphaByte, lens.channelGain === undefined ? null : validateChannelGain(lens.channelGain), tone);

    const directory = resolve(destination, imageId);
    await mkdir(directory, { recursive: true });
    const painted = await recolorCloudSlices({ slices, loadResource: path => readFile(containedPath(neutralDirectory, path)),
      sampleImageRgb: slabMaterial, preserveMaterialIntensity: true, appearance, outputDirectory: directory,
      encoding: { format: 'webp', quality: encoding.quality } });
    results.push({ imageId, directory, slices: painted.slices,
      coverage: { positiveAlphaTexels: painted.coverage.positiveAlphaTexels, recoloredTexels: painted.coverage.recoloredTexels } });
  }
  return results;
}
