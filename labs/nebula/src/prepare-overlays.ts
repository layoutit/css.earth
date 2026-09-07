/** Prepare WCS-positioned photographic inspection planes; no nebula extraction or image fitting. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { computeTextureAtlasPlanPublic, resolvePolyTextureLeafGeometry, type Polygon } from '@layoutit/polycss';
import { sha256 } from '../../../src/preparation/volume/source.js';
import { overlayCorners, type ImageWcs, type OverlayFrame } from './overlay-wcs.js';

interface InputImage {
  id: string; label: string; path: string; sha256: string; url?: string;
  sourcePageUrl: string; credit: string; license: string;
  wcs: ImageWcs; wcsSource: { url: string; sha256: string; description: string };
  registrationNote: string;
}
interface Recipe {
  schema: 'cssearth-nebula-overlay-recipe@1'; maxPixels: number;
  targets: { directory: string; referenceObject: string; images: InputImage[] }[];
}
async function inputBytes(input: InputImage) {
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
  const recipeBytes = await readFile(path), recipe: Recipe = JSON.parse(recipeBytes.toString('utf8'));
  if (recipe.schema !== 'cssearth-nebula-overlay-recipe@1' || !Number.isInteger(recipe.maxPixels) ||
      recipe.maxPixels < 256 || recipe.maxPixels > 4096) throw new TypeError('Invalid overlay recipe.');
  for (const target of recipe.targets) {
    const referenceBytes = await readFile(target.referenceObject);
    const descriptor = JSON.parse(referenceBytes.toString('utf8'));
    const { boundsUnits: _bounds, ...frame } = descriptor.properties.volume as OverlayFrame & { boundsUnits: unknown };
    const overlays = [], evidence = [];
    await mkdir(resolve(target.directory, 'prepared'), { recursive: true });
    for (const input of target.images) {
      if (!/^[a-z0-9-]+$/.test(input.id)) throw new TypeError('Overlay ids must be safe names.');
      const bytes = await inputBytes(input), original = await sharp(bytes).metadata();
      if (!original.width || !original.height) throw new TypeError('Overlay source dimensions missing.');
      const aspect = input.wcs.referenceDimension[0] / input.wcs.referenceDimension[1];
      if (Math.abs(original.width / original.height / aspect - 1) > .001) throw new TypeError(`WCS aspect differs: ${input.id}`);
      const texture = await sharp(bytes).toColourspace('srgb').resize({ width: recipe.maxPixels, height: recipe.maxPixels,
        fit: 'inside', withoutEnlargement: true }).webp({ quality: 92, alphaQuality: 100, effort: 5 }).toBuffer({ resolveWithObject: true });
      const texturePath = `prepared/${input.id}.webp`, width = texture.info.width, height = texture.info.height;
      await writeFile(resolve(target.directory, texturePath), texture.data);
      const vertices = overlayCorners(input.wcs, frame);
      const polygon: Polygon = { vertices, uvs: [[0, 0], [1, 0], [1, 1], [0, 1]], texture: texturePath,
        textureImageSource: { url: texturePath, width, height }, doubleSided: true,
        texturePresentation: { backend: 'image', lighting: 'source', projection: 'projective' } };
      const plan = computeTextureAtlasPlanPublic(polygon, overlays.length, { tileSize: 50, layerElevation: 50, seamBleed: 0 });
      const geometry = plan && resolvePolyTextureLeafGeometry(plan, { backend: 'image', lighting: 'source', projection: 'projective' });
      if (!geometry) throw new TypeError(`Could not prepare photographic plane: ${input.id}`);
      overlays.push({ id: input.id, label: input.label, texturePath, widthPx: width, heightPx: height,
        sha256: sha256(texture.data), bytes: texture.data.length,
        style: { width: `${geometry.leafWidth}px`, height: `${geometry.leafHeight}px`, transform: `matrix3d(${geometry.matrix})`,
          backgroundSize: geometry.backgroundSize.map(n => `${n}px`).join(' '),
          backgroundPosition: geometry.backgroundPosition.map(n => `${n}px`).join(' ') },
        sourcePageUrl: input.sourcePageUrl, credit: input.credit, registrationNote: input.registrationNote });
      evidence.push({ input, sourceDimensions: [original.width, original.height], verticesUnits: vertices,
        output: { texturePath, width, height, sha256: sha256(texture.data), bytes: texture.data.length } });
    }
    await writeFile(resolve(target.directory, 'overlays.json'), JSON.stringify({ schema: 'cssearth-nebula-overlays@1', frame, referenceDistanceUnits: Math.hypot(...frame.originM) / frame.metersPerUnit, overlays }, null, 2) + '\n');
    await mkdir(resolve(target.directory, 'source'), { recursive: true });
    await writeFile(resolve(target.directory, 'source/provenance.json'), JSON.stringify({
      schema: 'cssearth-nebula-overlay-provenance@1', recipe: { path, sha256: sha256(recipeBytes) },
      frame: { path: target.referenceObject, sha256: sha256(referenceBytes) }, images: evidence,
      method: 'Publisher ICRS TAN WCS rays intersect the observation tangent plane. Full image edges become a fixed PolyCSS projective quad.',
      limits: ['Image WCS metadata supplies angular registration; it does not validate the simulation morphology.',
        'No photograph-derived masks, cutouts, scale fitting or density-driven image warps are applied.',
        'The flat image plane records one observed projection; it does not assert physical depths for photographed features.',
        'The 2048px textures are inspection previews; native sources and WCS remain pinned for later processing.'],
    }, null, 2) + '\n');
    console.log(`OVERLAYS_READY ${target.directory}: ${overlays.length} WCS image planes`);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [path, extra] = process.argv.slice(2);
  if (!path || extra) throw new TypeError('Usage: prepare-overlays <recipe.json>');
  await prepareOverlays(path);
}
