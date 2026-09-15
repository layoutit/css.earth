/** Offline replay of an accepted historical density/material bake, without native observations or NOX. */
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';
import { parseDensityVolumeFrame } from '@cssearth/objects';
import { record, parseVolumeRecipe } from '../../../../src/preparation/volume/config.js';
import { prepareVolumeSlices } from '../../../../src/preparation/volume/slices.js';
import { defaultOverlayPlacement, updateOverlayPlacement } from '../alignment/overlay-placement.js';
import { createAlignedObservationMapping } from '../reconstruction/reconstruction-geometry.js';
import { parseCloudAppearance } from '../reconstruction/cloud-appearance.js';
import { prepareCloudDetail } from '../reconstruction/cloud-detail.js';
import { recolorCloudSlices } from '../reconstruction/cloud-material.js';
import { registeredImageSampler, registeredScalarSampler } from '../reconstruction/registered-image.js';
import { hash, localPath, pinned, type Pin } from './io.js';

const parsePin = (value: unknown): Pin => {
  const pin = record(value, 'pin');
  assert.ok(typeof pin.path === 'string'); assert.ok(typeof pin.sha256 === 'string');
  assert.match(pin.sha256, /^[a-f0-9]{64}$/);
  return { path: pin.path, sha256: pin.sha256 };
};
const parseJson = (bytes: Buffer): unknown => JSON.parse(bytes.toString());

/** Returns regenerated original slice directories; the delivery owner packs and verifies its atlases. */
export async function restoreCompactLmc(root: string, inputPin: Pin, destination: string): Promise<{imageId: string; directory: string}[]> {
  const input = record(parseJson(await pinned(root, inputPin)), 'compact LMC');
  assert.equal(input.schema, 'cssearth-compact-lmc@1');
  assert.equal(input.method, 'historical-alignment-density-material-v1');
  const densityPin = parsePin(input.densityRecipe);
  const recipe = parseVolumeRecipe(parseJson(await pinned(root, densityPin)));
  assert.equal(recipe.sky, undefined, 'Compact density replay does not acquire sky assets.');
  assert.equal(recipe.grid.acquisition, undefined, 'Compact density must be a local field.');
  const neutralDirectory = resolve(destination, 'neutral');
  await mkdir(neutralDirectory, { recursive: true });
  const slices = await prepareVolumeSlices({ sourceDirectory: dirname(localPath(root, densityPin.path)), outputDirectory: neutralDirectory, recipe });
  const frame = parseDensityVolumeFrame(input.frame);
  const expected = record(parseJson(await pinned(root, parsePin(input.atlasInputs))), 'atlas inputs');
  assert.equal(expected.schema, 'cssearth-volume-atlas-inputs@1');
  assert.ok(Array.isArray(expected.lenses));
  assert.ok(Array.isArray(input.lenses) && input.lenses.length > 0);
  const seen = new Set<string>(), results: {imageId: string; directory: string}[] = [];
  for (const value of input.lenses) {
    const lens = record(value, 'compact lens');
    assert.ok(typeof lens.imageId === 'string'); assert.match(lens.imageId, /^[a-z][a-z0-9-]*$/);
    const imageId = lens.imageId;
    assert.deepEqual(lens.densityFilter, { cutoff: 0, softness: .25, showRemoved: false }, 'Compact replay requires the accepted unchanged density filter.');
    assert.ok(!seen.has(imageId), 'Duplicate compact lens.'); seen.add(imageId);
    const historical = record(parseJson(await pinned(root, parsePin(lens.provenance))), 'historical provenance');
    assert.equal(historical.method, 'alignment-density-material-v1');
    const request = record(historical.request, 'historical request');
    assert.equal(request.imageId, imageId);
    assert.deepEqual(parseDensityVolumeFrame(request.frame), frame);
    const overlay = record(request.overlay, 'historical overlay');
    assert.ok(typeof overlay.widthPx === 'number'); assert.ok(typeof overlay.heightPx === 'number');
    assert.ok(typeof overlay.transform === 'string');
    assert.ok(Array.isArray(overlay.pivotCssPx) && overlay.pivotCssPx.every((v: unknown) => typeof v === 'number' && Number.isFinite(v)));
    const placement = updateOverlayPlacement(defaultOverlayPlacement(), record(overlay.placement, 'placement'));
    const w = overlay.widthPx, h = overlay.heightPx;
    const mapping = createAlignedObservationMapping({ style: {width: `${w}px`, height: `${h}px`, transform: overlay.transform,
      backgroundSize: `${w}px ${h}px`, backgroundPosition: '0px 0px'}, pivotCssPx: overlay.pivotCssPx, placement }, frame);
    const appearance = parseCloudAppearance(request.appearance);
    const materialBytes = await pinned(root, parsePin(lens.material));
    const metadata = await sharp(materialBytes).metadata();
    assert.equal(metadata.format, 'png'); assert.equal(metadata.channels, 3); assert.equal(metadata.depth, 'uchar');
    const {data: raw, info} = await sharp(materialBytes).raw().toBuffer({resolveWithObject: true});
    const photoMeta = record(historical.photo, 'historical photo');
    assert.equal(info.width, photoMeta.width); assert.equal(info.height, photoMeta.height);
    const intensity = new Float32Array(info.width * info.height);
    for (let p = 0; p < intensity.length; p++) intensity[p] = (raw[p*3]!*.2126+raw[p*3+1]!*.7152+raw[p*3+2]!*.0722)/255;
    // Already registered, north-up, unflopped RGB: resampling it again would alter registration and pixels.
    const photo = { width: info.width, height: info.height, rgb: new Uint8Array(raw), intensity, coveredPixels: 0 };
    const detail = prepareCloudDetail(photo, mapping, appearance);
    const settings = record(historical.settings, 'historical settings');
    assert.ok(typeof settings.quality === 'number');
    const directory = resolve(destination, imageId);
    const painted = await recolorCloudSlices({slices, loadResource: path => readFile(localPath(neutralDirectory, path)),
      sampleImageRgb: registeredImageSampler(photo, mapping), sampleDetailGain: registeredScalarSampler(photo, detail, mapping),
      appearance, outputDirectory: directory, encoding: {format: 'webp', quality: settings.quality}});
    const accepted: Record<string, unknown> | undefined = expected.lenses.map((entry: unknown) => record(entry, 'expected lens')).find(entry => entry.id === imageId);
    assert.ok(accepted && Array.isArray(accepted.resources));
    assert.equal(painted.slices.quads.length, accepted.resources.length);
    for (const entry of accepted.resources) {
      const resource = record(entry, 'expected resource');
      assert.ok(typeof resource.path === 'string'); assert.ok(resource.path.startsWith(`${imageId}/`));
      const bytes = await readFile(localPath(directory, resource.path.slice(imageId.length + 1)));
      assert.equal(hash(bytes), resource.sha256, `Compact LMC replay differs: ${resource.path}`);
      assert.equal(bytes.length, resource.bytes);
    }
    results.push({imageId, directory});
    console.log(`COMPACT_LMC_READY ${imageId}: ${painted.slices.quads.length} accepted slices reproduced exactly`);
  }
  assert.equal(seen.size, expected.lenses.length, 'Compact input must cover every accepted lens.');
  return results;
}
