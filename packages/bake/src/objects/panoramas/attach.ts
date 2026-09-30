/** Attach a body's surface panoramas to its prepared runtime definition: six sky-cube faces and a thumbnail each, written to
 * the body's public scene directory, and a small `panoramas` plan the runtime opens them from. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import type { AuthoredObjectDescriptor } from '@cssearth/objects';
import { compileCssSky, type BakedSky } from '../../sky/index.ts';
import { DECORATIVE_WEBP, writeLossyWebp } from '../../raster/index.ts';
import { parseSurfacePanoramas, type SurfacePanoramas } from './document.ts';
import { locatePanorama, parsePlacesTable, type PanoramaSite } from './site.ts';
import { panoramaFacePixels, SKY_BASES, type RgbImage } from './cube.ts';

export const SURFACE_PANORAMA_PLAN_SCHEMA = 'cssearth-surface-panorama-plan@1';
/** The panorama's own frame: x north, y west, z up at the camera. Nothing else is drawn in it. */
export const SURFACE_PANORAMA_FRAME = 'surface-panorama-local-north-west-up';
const THUMBNAIL_HEIGHT = 96;

interface Verified { readonly value: unknown }

/** Where the rover stood for each panorama, from the document's localisation table. */
export async function locateSurfacePanoramas(document: SurfacePanoramas, sourceDirectory: string): Promise<ReadonlyMap<string, PanoramaSite>> {
  const table = parsePlacesTable(await readFile(resolve(sourceDirectory, document.localization.path), 'utf8'), document.localization.path);
  return new Map(document.panoramas.map(panorama => [panorama.id, locatePanorama(table, panorama.sols, `${panorama.id}`)]));
}

export async function attachSurfacePanoramas({ descriptor, sources, sourceDirectory, publicDirectory, definition }: {
  descriptor: AuthoredObjectDescriptor; sources: ReadonlyMap<string, Verified>; sourceDirectory: string; publicDirectory: string; definition: Record<string, unknown>;
}): Promise<{ definition: Record<string, unknown>; count: number }> {
  const recipe = descriptor.recipe.panoramas;
  if (!recipe) return { definition, count: 0 };
  const source = sources.get(recipe.source);
  if (!source) throw new TypeError(`Authored recipe requires ${recipe.source}.`);
  const document = parseSurfacePanoramas(source.value), sites = await locateSurfacePanoramas(document, sourceDirectory);
  const id = descriptor.id, faceSize = recipe.faceSize, width = 4 * faceSize, url = (file: string) => `/scenes/${id}/${file}`;
  const entries = [];
  for (const panorama of document.panoramas) {
    const path = resolve(sourceDirectory, panorama.image), meta = await sharp(path, { limitInputPixels: false }).metadata();
    if (!meta.width || !meta.height) throw new TypeError(`${id} panorama ${panorama.id}: ${panorama.image} has no size.`);
    // The width spans 360°, so a face of `faceSize` pixels (90°) wants four face widths around.
    const height = Math.round(meta.height * width / meta.width), spanDeg = meta.height * 360 / meta.width;
    const decoded = await sharp(path, { limitInputPixels: false }).resize(width, height, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const image: RgbImage = { width, height, rgb: decoded.data };
    const faces: BakedSky['faces'] = [];
    for (const basis of SKY_BASES) {
      const file = `${id}-panorama-${panorama.id}-${basis.id}.webp`;
      const rgba = panoramaFacePixels(image, document.projection, basis, faceSize);
      const bytes = await writeLossyWebp(sharp(Buffer.from(rgba.buffer), { raw: { width: faceSize, height: faceSize, channels: 4 } }), resolve(publicDirectory, file), { alphaQuality: 100, effort: 5 });
      const corners = [[-1, 1], [1, 1], [1, -1], [-1, -1]] as const;
      faces.push({ ...basis, texturePath: file, widthPx: faceSize, heightPx: faceSize, bytes: bytes.length, uvs: [[0, 0], [1, 0], [1, 1], [0, 1]],
        vertices: corners.map(([u, v]) => basis.forwardIcrf.map((f, i) => f + u * basis.rightIcrf[i]! + v * basis.upIcrf[i]!) as [number, number, number]) });
    }
    const thumbnail = `${id}-panorama-${panorama.id}-thumbnail.webp`;
    const thumbnailWidth = Math.round(THUMBNAIL_HEIGHT * 2 * Math.min(4, width / height));
    // The strip around the horizon, north in the middle as published: a picture for the list, not data.
    await sharp(decoded.data, { raw: { width, height, channels: 3 } }).resize(thumbnailWidth * 2, THUMBNAIL_HEIGHT * 2, { fit: 'cover', position: 'top' })
      .webp(DECORATIVE_WEBP).toFile(resolve(publicDirectory, thumbnail));
    const site = sites.get(panorama.id)!;
    const { sky, resources } = compileCssSky({ faces, provenance: { image: panorama.image, pageUrl: panorama.pageUrl }, approximation: {
      projection: `cylinder, one scale in both axes; azimuth ${document.projection.azimuthAtCentreDeg}° at the centre and ${document.projection.topElevationDeg}° elevation at the top, as the publisher states`,
      resampling: 'bilinear in the published sRGB bytes', unimaged: 'transparent' } },
      { referenceFrame: SURFACE_PANORAMA_FRAME, epochJdTt: 0 } as Parameters<typeof compileCssSky>[1]);
    entries.push({ id: panorama.id, title: panorama.title, sols: [...panorama.sols], camera: panorama.camera, credit: panorama.credit, pageUrl: panorama.pageUrl,
      site: { latitudeDeg: site.latitudeDeg, longitudeDegEast: site.longitudeDegEast, localization: site.localization },
      spanDeg: Number(spanDeg.toFixed(2)), thumbnail: url(thumbnail), faces: faces.map(face => url(face.texturePath)), sky, resources });
  }
  const plan = { schema: SURFACE_PANORAMA_PLAN_SCHEMA, source: { label: document.source, url: document.sourcePage }, frame: SURFACE_PANORAMA_FRAME, panoramas: entries };
  return { definition: { ...definition, panoramas: plan }, count: entries.length };
}
