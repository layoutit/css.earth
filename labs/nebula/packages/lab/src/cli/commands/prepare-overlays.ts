import { parseLabModelJson } from '../../resources/model-paths.ts';
/** Prepare WCS-positioned photographic inspection planes; no nebula extraction or image fitting. */
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { prepareOverlayGeometry } from '../../adapters/renderer/overlay-geometry.ts';
import { sha256 } from '@cssearth/core/node';
import { overlayCorners, type ImageWcs, type OverlayFrame, defaultOverlayPlacement, updateOverlayPlacement, type OverlayPlacement, transferOverlayAlignment, registeredOverlayCorners, type ImageRegistration } from '@cssearth/bake/volume';
import { skyBandCompositeFile } from '../../adapters/sources/sky-bands.ts';
import { composeSkyBandSource, verifySkyBandSource } from '../../server/workflows/observations/sky-band-source.ts';

interface InputImage {
  id: string; label: string; path: string; sha256: string; url?: string;
  sourcePageUrl: string; credit: string; license: string;
  wcs?: ImageWcs; wcsSource: { url: string; sha256: string; description: string };
  registration?: ImageRegistration;
  registrationNote: string; maxPixels?: number; legacyPlacementBasis?: string; useSavedAlignment?: boolean;
  /** Pinned publisher TIFFs can contain individual compressed strips larger than libtiff's default allocation limit. */
  allowLargeTiff?: boolean;
  /** Composed from a pinned survey band recipe instead of downloaded; `path` is then its hash-named composite and `wcs` its grid. */
  skyBands?: { path: string; sha256: string };
}
interface Recipe {
  schema: 'cssearth-nebula-overlay-recipe@1'; maxPixels: number;
  targets: { directory: string; referenceObject: string; images: InputImage[]; alignment?: { path: string; sha256: string } }[];
}
async function skyBandBytes(input: InputImage) {
  if (!input.skyBands || input.url || !input.wcs || !/^[0-9a-f]{64}$/.test(input.skyBands.sha256)) throw new TypeError(`A sky band image names its recipe and grid WCS, not a URL: ${input.id}`);
  const source = { id: input.id, width: input.wcs.referenceDimension[0], height: input.wcs.referenceDimension[1], wcs: input.wcs, skyBands: input.skyBands };
  // Always verify the recipe and grid first, so a warm composite cache cannot hide a changed or missing recipe.
  await verifySkyBandSource(source);
  if (basename(input.path) !== skyBandCompositeFile(input.id)) throw new TypeError(`A sky band composite is cached under its own hash: ${input.id}`);
  let bytes = await readFile(input.path).catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return null; throw error; });
  if (!bytes) {
    console.log(`OVERLAY_COMPOSE ${input.id}`);
    const composed = await composeSkyBandSource(source);
    if (composed.sha256 !== input.sha256) throw new Error(`Composed sky band raster ${composed.sha256} differs from its pin: ${input.id}`);
    await mkdir(dirname(input.path), { recursive: true });
    await writeFile(`${input.path}.sky-bands.json`, JSON.stringify(composed.evidence, null, 2) + '\n');
    await writeFile(`${input.path}.part`, composed.bytes); await rename(`${input.path}.part`, input.path);
    bytes = composed.bytes;
  }
  if (sha256(bytes) !== input.sha256) throw new Error(`Changed sky band composite: ${input.path}`);
  return bytes;
}
async function inputBytes(input: InputImage) {
  if (input.skyBands) return skyBandBytes(input);
  let bytes = await readFile(input.path).catch(() => null);
  if ((!bytes || sha256(bytes) !== input.sha256) && input.url) {
    const response = await fetch(input.url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`Overlay source download failed: ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (sha256(bytes) !== input.sha256) throw new Error(`Overlay source hash differs: ${input.id}`);
    await mkdir(dirname(input.path), { recursive: true }); await writeFile(input.path, bytes);
  }
  if (!bytes || sha256(bytes) !== input.sha256) throw new Error(`Missing pinned overlay source: ${input.id}`);
  return bytes;
}

export async function prepareOverlays(path: string) {
  const recipeBytes = await readFile(path), recipe: Recipe = parseLabModelJson(recipeBytes.toString('utf8'));
  if (recipe.schema !== 'cssearth-nebula-overlay-recipe@1' || !Number.isInteger(recipe.maxPixels) ||
      recipe.maxPixels < 256 || recipe.maxPixels > 4096) throw new TypeError('Invalid overlay recipe.');
  for (const target of recipe.targets) {
    const referenceBytes = await readFile(target.referenceObject);
    const descriptor = parseLabModelJson(referenceBytes.toString('utf8'));
    const { boundsUnits: _bounds, ...frame } = descriptor.properties.volume as OverlayFrame & { boundsUnits: unknown };
    const overlays = [], evidence = [];
    await mkdir(resolve(target.directory, 'prepared'), { recursive: true });
    for (const input of target.images) {
      if (!/^[a-z0-9-]+$/.test(input.id)) throw new TypeError('Overlay ids must be safe names.');
      const bytes = await inputBytes(input), original = await sharp(bytes).metadata();
      if (!original.width || !original.height) throw new TypeError('Overlay source dimensions missing.');
      if (input.wcs) {
        const aspect = input.wcs.referenceDimension[0] / input.wcs.referenceDimension[1];
        if (Math.abs(original.width / original.height / aspect - 1) > .001) throw new TypeError(`WCS aspect differs: ${input.id}`);
      } else if (!input.registration) throw new TypeError(`Image needs a sky registration: ${input.id}`);
      const maxPixels = input.maxPixels ?? recipe.maxPixels;
      if (!Number.isInteger(maxPixels) || maxPixels < 256 || maxPixels > 8192) throw new TypeError('Invalid image preview resolution.');
      const texture = await sharp(bytes, { unlimited: input.allowLargeTiff === true }).toColourspace('srgb').resize({ width: maxPixels, height: maxPixels,
        fit: 'inside', withoutEnlargement: true }).webp({ quality: 92, alphaQuality: 100, effort: 5 }).toBuffer({ resolveWithObject: true });
      const texturePath = `prepared/${input.id}.webp`, width = texture.info.width, height = texture.info.height;
      await writeFile(resolve(target.directory, texturePath), texture.data);
      const vertices = input.registration ? registeredOverlayCorners(input.registration, original.width, original.height, frame) : overlayCorners(input.wcs!, frame);
      const geometry = prepareOverlayGeometry(vertices, width, height);
      // Decode the prepared projective image centre offline, including its homogeneous divisor.
      const matrix = geometry.matrix.split(',').map(Number), cx = geometry.leafWidth / 2, cy = geometry.leafHeight / 2;
      const w = matrix[3]! * cx + matrix[7]! * cy + matrix[15]!;
      const pivotCssPx = [0, 1, 2].map(axis => (matrix[axis]! * cx + matrix[axis + 4]! * cy + matrix[axis + 12]!) / w);
      if (!pivotCssPx.every(Number.isFinite)) throw new TypeError(`Invalid image centre: ${input.id}`);
      overlays.push({ id: input.id, label: input.label, texturePath, widthPx: width, heightPx: height,
        initialPlacement: undefined as OverlayPlacement | undefined, initialOpacity: undefined as number | undefined,
        sha256: sha256(texture.data), bytes: texture.data.length, pivotCssPx, legacyPlacementBasis: input.legacyPlacementBasis,
        style: { width: `${geometry.leafWidth}px`, height: `${geometry.leafHeight}px`, transform: `matrix3d(${geometry.matrix})`,
          backgroundSize: geometry.backgroundSize.map(n => `${n}px`).join(' '),
          backgroundPosition: geometry.backgroundPosition.map(n => `${n}px`).join(' ') },
        sourcePageUrl: input.sourcePageUrl, credit: input.credit, registrationNote: input.registrationNote });
      evidence.push({ input, sourceDimensions: [original.width, original.height], verticesUnits: vertices,
        output: { texturePath, width, height, sha256: sha256(texture.data), bytes: texture.data.length } });
    }
    if (target.alignment) {
      const bytes = await readFile(target.alignment.path);
      if (sha256(bytes) !== target.alignment.sha256) throw new TypeError('Saved image alignment has changed.');
      const saved = parseLabModelJson(bytes.toString('utf8'));
      const reference = overlays.find(image => image.id === saved.imageId);
      if (saved.schema !== 'cssearth-nebula-image-placement@1' || !reference ||
          !(saved.opacity >= 0 && saved.opacity <= 1)) throw new TypeError('Invalid saved image alignment.');
      const placement = updateOverlayPlacement(defaultOverlayPlacement(), { ...saved.positionKpc,
        rotationX: saved.rotationDegrees.x, rotationY: saved.rotationDegrees.y, rotationZ: saved.rotationDegrees.z, scale: saved.scale });
      for (const image of overlays) {
        if (target.images.find(input => input.id === image.id)?.useSavedAlignment === false) continue;
        image.initialPlacement = transferOverlayAlignment(placement, reference.pivotCssPx, image.pivotCssPx, 50 * 3.085677581491367e19 / frame.metersPerUnit);
        image.initialOpacity = saved.opacity;
      }
    }
    await writeFile(resolve(target.directory, 'overlays.json'), JSON.stringify({ schema: 'cssearth-nebula-overlays@1', frame, referenceDistanceUnits: Math.hypot(...frame.originM) / frame.metersPerUnit, overlays }, null, 2) + '\n');
    await mkdir(resolve(target.directory, 'source'), { recursive: true });
    await writeFile(resolve(target.directory, 'source/provenance.json'), JSON.stringify({
      schema: 'cssearth-nebula-overlay-provenance@1', recipe: { path, sha256: sha256(recipeBytes) },
      frame: { path: target.referenceObject, sha256: sha256(referenceBytes) }, images: evidence, alignment: target.alignment,
      method: 'Publisher sky coordinates or matched-star homographies map full image edges to the observation tangent plane, compiled as fixed PolyCSS projective quads.',
      limits: ['Image WCS metadata supplies angular registration; it does not validate the simulation morphology.',
        'Source sky placement is retained. An optional saved manual alignment supplies initial display controls unless an image explicitly keeps calibrated sky placement.',
        'The flat image plane records one observed projection; it does not assert physical depths for photographed features.',
        'Textures are bounded inspection previews; native sources and WCS remain pinned for later processing.'],
    }, null, 2) + '\n');
    console.log(`OVERLAYS_READY ${target.directory}: ${overlays.length} WCS image planes`);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [path, extra] = process.argv.slice(2);
  if (!path || extra) throw new TypeError('Usage: prepare-overlays <recipe.json>');
  await prepareOverlays(path);
}
