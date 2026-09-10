import { isArray } from '../../../src/platform/is-array.mts';
import {parse} from '../material-composition/data-schema.mts';
import {radialRecipe, type SourcePin, type ObservedRadialLayer} from './radial-contract.mts';
import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import sharp from 'sharp';
import { rasterAnnularField, rasterObservedRadialField, colorizeRadialField, rasterProjectedStripShadow } from './rings.mts';
export { mapRadius, ringRayOccluded, rasterAnnularField, rasterObservedRadialField, sampleRadialProfile } from './rings.mts';

const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function fail(message: string): never { throw new TypeError(`Radial preparation: ${message}`); }
function positive(value: number) { return Number.isFinite(value) && value > 0; }
function pair(value: readonly number[]) { return isArray(value) && value.length === 2 && value.every(Number.isFinite) && value[1] > value[0]; }
function color(value: readonly number[]) { return isArray(value) && value.length === 3 && value.every(channel => Number.isInteger(channel) && channel >= 0 && channel <= 255); }
function validateFiniteTree(value: unknown): void {
  if (typeof value === 'number' && !Number.isFinite(value)) fail('nonfinite recipe parameter.');
  if (typeof value === 'function' || typeof value === 'symbol') fail('configuration must contain data.');
  if (value && typeof value === 'object') for (const child of Object.values(value as Record<string, unknown>)) validateFiniteTree(child);
}

export function parseRadialLayerRecipe(input: unknown) {
  const value = parse(input, radialRecipe, 'radial layer recipe');
  if (!value || value.schema !== 'cssearth-radial-layer-recipe@1' || value.units !== 'kilometers' ||
      !isArray(value.sources) || !isArray(value.layers) || value.layers.length === 0) fail('invalid recipe.');
  validateFiniteTree(value);
  const sourcePaths = new Set();
  for (const source of value.sources) {
    if (!source || typeof source.path !== 'string' || source.path.startsWith('/') || source.path.split(/[\\/]/).includes('..') ||
        !/^[a-f0-9]{64}$/.test(source.expectedSha256) || !Number.isSafeInteger(source.expectedBytes) || source.expectedBytes <= 0 || sourcePaths.has(source.path)) fail('invalid source pin.');
    sourcePaths.add(source.path);
  }
  const outputs = new Set();
  for (const layer of value.layers) {
    if (!['annular-field', 'observed-radial-profile'].includes(layer.kind) ||
        !Number.isInteger(layer.size) || layer.size < 2 || layer.size > 8192 ||
        !isArray(layer.densities) || layer.densities.length === 0 ||
        new Set(layer.densities).size !== layer.densities.length || layer.densities.some(density => ![1, 2].includes(density)) ||
        layer.size * Math.max(...layer.densities) > 8192 ||
        !/^[a-z0-9][a-z0-9-]*\{suffix\}\.webp$/.test(layer.output) || outputs.has(layer.output) ||
        !layer.encoding || typeof layer.encoding !== 'object' ||
        !['independent', 'downsample-highest', undefined].includes(layer.densityMode)) fail('invalid layer output.');
    outputs.add(layer.output);
    for(const overlay of layer.overlays??[]){
      if(overlay.kind!=='projected-strip-shadow'||layer.densityMode==='downsample-highest'||!positive(overlay.bodyRadius)||!positive(overlay.outerRadius)||overlay.outerRadius<=overlay.bodyRadius||!isArray(overlay.direction)||overlay.direction.length!==2||!overlay.direction.every(Number.isFinite)||Math.hypot(...overlay.direction)===0||!color(overlay.color)||!positive(overlay.startFraction)||!positive(overlay.edgeFraction)||!Number.isInteger(overlay.maximumAlpha)||overlay.maximumAlpha<1||overlay.maximumAlpha>255||![0,1].includes(overlay.centerInset)||!Number.isFinite(overlay.marginPixels)||overlay.marginPixels<0||!overlay.encoding||!/^[a-z0-9][a-z0-9-]*\{suffix\}\.webp$/u.test(overlay.output)||outputs.has(overlay.output))fail('invalid radial overlay.');
      outputs.add(overlay.output);
    }
    for (const variant of layer.variants ?? []) {
      if (!/^[a-z0-9][a-z0-9-]*\{suffix\}\.webp$/.test(variant.output) || outputs.has(variant.output) ||
          !isArray(variant.palette) || variant.palette.length !== 3 || !variant.palette.every(color) ||
          !positive(variant.outerRadius) || !positive(variant.exponent) || !positive(variant.gain) || !positive(variant.outerGain) ||
          !isArray(variant.luminance) || variant.luminance.length !== 3 || !variant.luminance.every(positive) ||
          !isArray(variant.radialGains) || variant.radialGains.some((band, index) => !positive(band.upperBound) || !positive(band.gain) ||
            (index > 0 && band.upperBound <= variant.radialGains[index - 1].upperBound))) fail('invalid spectral radial variant.');
      outputs.add(variant.output);
    }
    if (layer.kind === 'annular-field') {
      const { grid, mapping } = layer;
      if (!positive(layer.outerRadius) || !grid || ![0, 1].includes(grid.centerInset) || ![0, 0.5].includes(grid.sampleOffset) ||
          !Number.isFinite(grid.marginPixels) || grid.marginPixels < 0 || grid.marginPixels >= (layer.size - grid.centerInset) / 2 ||
          !['divide-multiply', 'multiply-hypot'].includes(grid.scaleOrder) ||
          !['maximum', 'front-to-back'].includes(layer.composition) || ![1, 255].includes(layer.alphaUnits) ||
          (layer.composition === 'front-to-back' && layer.alphaUnits !== 1) ||
          !Number.isInteger(layer.maximumAlpha) || layer.maximumAlpha < 0 || layer.maximumAlpha > 255 ||
          !mapping || !['linear', 'piecewise-log'].includes(mapping.kind)) fail('invalid annular field.');
      if (mapping.kind === 'linear' ? !positive(mapping.scale) : !isArray(mapping.knots) || mapping.knots.length < 2 ||
        mapping.knots.some((knot, index) => !isArray(knot) || knot.length !== 2 || knot.some(value => !positive(value)) ||
          (index > 0 && (knot[0] <= mapping.knots[index - 1][0] || knot[1] <= mapping.knots[index - 1][1])))) fail('invalid radius mapping.');
      if (!isArray(layer.bands) || layer.bands.length === 0) fail('empty annular field.');
      for (const band of layer.bands) {
        if (!['constant', 'tent', 'smooth-annulus'].includes(band.envelope) || !color(band.color) ||
            !Number.isFinite(band.opacity) || band.opacity < 0) fail('invalid band.');
        if (band.envelope === 'tent' ? !positive(band.center) || !positive(band.width) || !positive(band.edgeGain) : !pair(band.bounds)) fail('invalid radial bounds.');
        if (band.envelope === 'smooth-annulus' && (!isArray(band.fade) || band.fade.length !== 2 || !band.fade.every(positive) || band.bounds[0] <= band.fade[0])) fail('invalid annular fade.');
        if (band.arcs && (!isArray(band.arcs.centers) || band.arcs.centers.length === 0 || !band.arcs.centers.every(Number.isFinite) || !positive(band.arcs.halfWidth))) fail('invalid arcs.');
      }
      if (layer.shadow && (!isArray(layer.shadow.direction) || layer.shadow.direction.length !== 3 ||
          !layer.shadow.direction.every(Number.isFinite) || Math.hypot(...layer.shadow.direction) === 0 ||
          !positive(layer.shadow.equatorialRadius) || !positive(layer.shadow.polarRadius) ||
          !Number.isFinite(layer.shadow.luminance) || layer.shadow.luminance < 0 || layer.shadow.luminance > 1)) fail('invalid shadow geometry.');
    } else {
      if (!pair(layer.bounds) || !pair(layer.sourceBounds) || layer.sourceBounds[0] <= layer.bounds[0] ||
          layer.sourceBounds[1] !== layer.bounds[1] || !sourcePaths.has(layer.colorSource) || !sourcePaths.has(layer.transparencySource) ||
          !isArray(layer.channelFactors) || layer.channelFactors.length !== 3 || !layer.channelFactors.every(positive) ||
          !layer.interior || !color(layer.interior.color) || !isArray(layer.interior.centers) || !layer.interior.centers.length ||
          !layer.interior.centers.every(positive) || !positive(layer.interior.sigma) ||
          !isArray(layer.operations) || layer.operations.some(operation => !pair(operation.bounds) ||
            !['alpha-cap', 'clear', 'edge-core', 'alpha-gain'].includes(operation.kind)) ||
          !layer.readability || !isArray(layer.readability.features) || !positive(layer.readability.alphaGain) ||
          layer.densities.some(density => !Number.isSafeInteger(layer.readability.minimumPixels[density]) || layer.readability.minimumPixels[density] <= 0)) fail('invalid observed profile.');
    }
  }
  return value;
}

async function verifyInputs(root: string, sources: readonly SourcePin[]) {
  const actualRoot = await realpath(root), result = new Map();
  for (const source of sources) {
    const file = await realpath(resolve(root, source.path));
    const offset = relative(actualRoot, file);
    if (offset === '..' || offset.startsWith(`..${sep}`) || offset.startsWith(sep)) fail('source escapes its directory.');
    const bytes = await readFile(file);
    if (bytes.length !== source.expectedBytes || digest(bytes) !== source.expectedSha256) fail(`source pin mismatch: ${source.path}`);
    result.set(source.path, bytes);
  }
  return result;
}
async function observedInputs(layer: ObservedRadialLayer, inputs: ReadonlyMap<string, Buffer>) {
  const color = await sharp(inputs.get(layer.colorSource)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const transparency = await sharp(inputs.get(layer.transparencySource)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (color.info.height !== 1 || transparency.info.height !== 1 || color.info.width !== transparency.info.width ||
      color.info.channels !== 3 || transparency.info.channels !== 3) fail('observed profiles must be matching RGB rows.');
  return { color: color.data, transparency: transparency.data, width: color.info.width };
}

/** Generic preparation entry. It never imports a body module or runtime product. */
export async function prepareGiantLayers({ sourceDirectory, publicDirectory, config, write = true }: {sourceDirectory: string; publicDirectory?: string; config: unknown; write?: boolean}) {
  const recipe = parseRadialLayerRecipe(config);
  const inputs = await verifyInputs(sourceDirectory, recipe.sources);
  const assets = [];
  for (const layer of recipe.layers) {
    const profile = layer.kind === 'observed-radial-profile' ? await observedInputs(layer, inputs) : null;
    const highestDensity = Math.max(...layer.densities), highestSize = layer.size * highestDensity;
    const raster = (size: number, density: number) => {
      if (layer.kind === 'observed-radial-profile') {
        if (!profile) throw new Error('Observed radial profile is unavailable.');
        return rasterObservedRadialField(layer, size, layer.readability.minimumPixels[density], profile);
      }
      return rasterAnnularField(layer, size);
    };
    const master = layer.densityMode === 'downsample-highest' ? raster(highestSize, highestDensity) : null;
    for (const density of layer.densities) {
      const size = layer.size * density, data = master ?? raster(size, density), sourceSize = master ? highestSize : size;
      let pipeline = sharp(data, { raw: { width: sourceSize, height: sourceSize, channels: 4 } });
      if (sourceSize !== size) pipeline = pipeline.resize(size, size, { kernel: sharp.kernel.lanczos3 });
      const bytes = await pipeline.webp(layer.encoding).toBuffer();
      const filename = layer.output.replace('{suffix}', density === 2 ? '@2x' : '');
      assets.push({ filename, width: size, height: size, bytes: bytes.length, sha256: digest(bytes), data: bytes });
      for(const overlay of layer.overlays??[]){
        const shadow=rasterProjectedStripShadow(data,size,overlay),encoded=await sharp(shadow,{raw:{width:size,height:size,channels:4}}).webp(overlay.encoding).toBuffer(),filename=overlay.output.replace('{suffix}',density===2?'@2x':'');
        assets.push({filename,width:size,height:size,bytes:encoded.length,sha256:digest(encoded),data:encoded});
      }
      if (layer.variants?.length) {
        const decoded = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        for (const variant of layer.variants) {
          const data = colorizeRadialField(decoded.data, decoded.info.width, decoded.info.height, variant);
          const encoded = await sharp(data, { raw: decoded.info }).webp(variant.encoding).toBuffer();
          const filename = variant.output.replace('{suffix}', density === 2 ? '@2x' : '');
          assets.push({ filename, width: size, height: size, bytes: encoded.length, sha256: digest(encoded), data: encoded });
        }
      }
    }
  }
  if (write) {
    if (!publicDirectory) throw new TypeError('Radial output directory is required for writing.');
    await mkdir(publicDirectory, { recursive: true });
    for (const asset of assets) await writeFile(resolve(publicDirectory, asset.filename), asset.data);
  }
  return { schema: 'cssearth-prepared-radial-layers@1', sources: recipe.sources, assets };
}
