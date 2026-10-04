/**
 * Offline replay of an accepted simulation-guided finite-emission delivery.
 *
 * The fitted emission field, its envelope gain map, the neutral alpha bank and the pinned depth density
 * are delivered inputs, so no fit, star removal or registration runs here. Per dataset this repeats the
 * accepted material arithmetic exactly: bilinear registered color inside the coverage mask, component
 * plus envelope emission through the same perspective transform, and the same alpha-limited slab
 * material recoloring the same neutral textures at the same encoder settings.
 */
import { readCompactFiniteEmission, readSimulationEnvelopeRecord, type EmissionFieldModel, type VolumeSlices, type Vector3 } from '@cssearth/objects';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { createEmissionField } from '../../fields/emission.ts';
import { createEmissionMaterial } from '../../materials/component-material.ts';
import { compilerSlabMaterial, datasetChannelGainMaterial, type DatasetTone } from '../../materials/slab-material.ts';
import { createEnvelopeSampler, envelopeChromaticity, envelopeChromaSettings } from '../../fields/simulation-envelope.ts';
import { physicalToField, angularScale } from '../../coordinates/observer-tangent.ts';

import { recolorCloudSlices } from '../slices/material.ts';
import { loadSimulationPrior } from './simulation-prior.ts';
import { localPath, pinned, type CompilerPin } from './io.ts';
import { containedPath } from './density-grid.ts';

/** Delivered JSON may be gzipped; the path says which. */
async function json(root: string, pin: CompilerPin): Promise<unknown> {
  const bytes = await pinned(root, pin);
  return JSON.parse((pin.path.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString('utf8'));
}

export interface CompactFiniteDataset {
  imageId: string;
  /** Directory of regenerated material textures, matching the accepted delivery layout. */
  directory: string;
  /** Painted slice bank, ready for the host's volume compiler. */
  slices: VolumeSlices;
  coverage: { positiveAlphaTexels: number; recoloredTexels: number };
}

/**
 * Regenerate every dataset of one delivered finite-emission model into `destination/<imageId>`.
 * Returns the painted banks; the delivery owner compiles, packs and verifies them.
 */
export async function restoreCompactFiniteEmission(root: string, inputPin: CompilerPin, destination: string): Promise<CompactFiniteDataset[]> {
  const input = readCompactFiniteEmission(await json(root, inputPin));
  const { distance, modelTangent, exposureGain, fullChromaAlphaByte, encoding, datasets } = input;
  const appearance = input.appearance;
  assert.equal(appearance.detailStrength, 0, 'Finite component material does not support projected detail enhancement');
  const field = await json(root, input.emissionField) as EmissionFieldModel;
  const preparedField = createEmissionField(field);
  const slices = await json(root, input.neutralSlices) as VolumeSlices;
  const neutralDirectory = localPath(root, input.neutralTextures);
  const A = angularScale(distance);

  const envelopeRecord = readSimulationEnvelopeRecord(await json(root, input.envelope), message => assert.fail(message));
  const settings = envelopeRecord.settings, chroma = envelopeChromaSettings(settings);
  const depthPrior = await loadSimulationPrior(root, input.priorRecipe, distance, modelTangent);
  const envelopeGrid = { ...envelopeRecord, gain: Float32Array.from(envelopeRecord.gain) };
  const envelopeAt = createEnvelopeSampler(envelopeGrid, depthPrior);

  // A dataset tone curve is indexed by the model's own front-projection byte at the texel's sky position, read
  // from the delivered projection exactly as the accepted bake read the model's `fit-projection.png`.
  const toneProjection = input.toneProjection;
  const levelAt = toneProjection === undefined ? null : await (async () => {
    const grid = toneProjection, pb = grid.bounds, w = grid.width, h = grid.height;
    const projection = await sharp(await pinned(root, grid.image)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
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
  const results: CompactFiniteDataset[] = [];
  for (const dataset of datasets) {
    const { imageId, bounds } = dataset;

    const registered = await pinned(root, dataset.registered);
    const decoded = await sharp(registered).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width, height } = decoded.info, rgb = decoded.data;
    // Only this mask's alpha is read, at the registered resolution and again at envelope scale, exactly
    // as the accepted bake read the registered original's alpha.
    const maskBytes = await pinned(root, dataset.coverage);
    const coverage = await sharp(maskBytes).resize(width, height, { fit: 'fill' }).ensureAlpha().raw().toBuffer();

    const datasetMaterial = createEmissionMaterial(field, { id: imageId, sampleRgb(x, y, out) {
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

    const datasetRgb = await sharp(registered).resize(envelopeGrid.width, envelopeGrid.height, { fit: 'fill' }).removeAlpha().raw().toBuffer();
    const datasetAlpha = await sharp(maskBytes).resize(envelopeGrid.width, envelopeGrid.height, { fit: 'fill' }).ensureAlpha().raw().toBuffer();
    const datasetCoverage = Uint8Array.from({ length: envelopeGrid.width * envelopeGrid.height }, (_, p) => datasetAlpha[p * 4 + 3]! >= 250 ? 1 : 0);
    const envelopeColor = envelopeChromaticity(datasetRgb, datasetCoverage, envelopeGrid.width, envelopeGrid.height, envelopeGrid.bounds, settings.scalePixels, chroma.halfSaturationQuantile, chroma.skyQuantile, chroma.coverageTaper);

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
      const hasComponent = ce > 0 && datasetMaterial.sampleMaterial(p[0], p[1], p[2], componentColor);
      const hasEnvelope = ee > 0 && envelopeColor(p[0], p[1], envelopeRgb);
      const cw = hasComponent ? ce : 0, ew = hasEnvelope ? ee : 0;
      if (!(cw + ew > 0)) return false;
      for (let c = 0; c < 3; c++) out[c] = Math.min(255, Math.max(0, (cw * componentColor[c]! + ew * envelopeRgb[c]!) / (cw + ew)));
      return true;
    };
    // A delivered dataset may carry its own per-channel display correction and fitted tone curve against its own
    // source image; both straddle the alpha chroma limit exactly as the accepted bake applies them.
    let tone: DatasetTone | null = null;
    if (dataset.toneCurve !== undefined) {
      assert.ok(levelAt, `${imageId} carries a tone curve but the delivery has no tone projection.`);
      tone = { curve: dataset.toneCurve, levelAt };
    }
    const slabMaterial = datasetChannelGainMaterial(compilerSlabMaterial(sampleEmission, sampleMaterial), sampleEmission,
      exposureGain, fullChromaAlphaByte, dataset.channelGain === undefined ? null : dataset.channelGain, tone);

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
