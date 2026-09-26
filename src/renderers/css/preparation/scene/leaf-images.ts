import type { RasterRecipe } from '@cssearth/bake/raster';
import { RASTER_DENSITY, RASTER_LEVEL_FACTORS, rasterPageName, rasterPagePlan } from '@cssearth/bake/raster';
import type { GeometryProfile } from './profile.js';
import type { LeafImagePixels } from './projector.js';

export interface LeafImageSources {
  objectId: string; profile: GeometryProfile; raster: RasterRecipe;
  /** The prepared lens controls (content/lenses.ts): every lens names its surface and pole images. */
  lenses: unknown;
  /** The prepared cutaway images (preparation/raster/interior.ts); required with a cutaway. */
  interior?: unknown;
}

type InteriorImage = 'outerSurface' | 'outerSurfaceUnlit' | 'outerPoles' | 'outerPolesUnlit' | 'core' | 'corePoles' | 'section';

function record(objectId: string, value: unknown, at: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${objectId}: ${at} must be an object, not ${JSON.stringify(value)}.`);
  return value as Record<string, unknown>;
}
/** A url field's value: absent, or a prepared scene asset. */
function urls(objectId: string, source: Record<string, unknown>, fields: readonly string[], at: string): string[] {
  return fields.flatMap(field => {
    const value = source[field];
    if (value === undefined) return [];
    if (typeof value !== 'string' || !value.startsWith('/scenes/')) throw new TypeError(`${objectId}: ${at}.${field} must be a /scenes/ url, not ${JSON.stringify(value)}.`);
    return [value];
  });
}

/** Every published image a leaf can show, keyed by the url the leaf's patch names (the geometry profile's surface and pole
 * images, the cutaway's outer poles, core and section). A band leaf shows each lens's surface, and a paged surface publishes
 * no whole atlas but each page at every texture level (composite.ts reads the same files); the cutaway draws the same band
 * leaves over its outer shell, lit or unlit (row-bank-cutaway.ts). A cap shows each lens's pole image. An interior lens
 * draws the cutaway, and a dataset that borrows another lens's surface draws that lens's. */
export function leafImageCandidates({ objectId, profile, raster, lenses, interior }: LeafImageSources): ReadonlyMap<string, readonly string[]> {
  const controls = record(objectId, lenses, 'prepared lenses').controls;
  if (!Array.isArray(controls) || !controls.length) throw new TypeError(`${objectId}: prepared lenses.controls must list the lenses.`);
  const pages = rasterPagePlan(raster, RASTER_DENSITY), last = RASTER_LEVEL_FACTORS.length - 1;
  const surfaceFiles = (url: string) => {
    if (!pages) return [url];
    const cut = url.lastIndexOf('/') + 1, name = url.slice(cut), surface = pages.surfaces.find(entry => entry.name === name);
    if (!surface) throw new TypeError(`${objectId}: leaf image ${url} is not a paged surface of this body (${pages.surfaces.map(entry => entry.name).join(', ')}).`);
    return Array.from({ length: pages.pageCount }, (_, page) => RASTER_LEVEL_FACTORS.map((factor, level) =>
      url.slice(0, cut) + rasterPageName(name, page, level === last ? undefined : surface.width / factor))).flat();
  };
  const candidates = new Map<string, Set<string>>();
  const add = (key: string, images: readonly string[]) => {
    const set = candidates.get(key) ?? candidates.set(key, new Set()).get(key)!;
    for (const image of images) set.add(image);
  };
  // The profile's own images only locate the leaves: a leaf draws its lens's texture, never the profile's url (projector.ts).
  add(profile.surface.surface.url, []);
  add(profile.surface.poles.url, []);
  controls.forEach((value, index) => {
    const lens = record(objectId, value, `prepared lenses.controls[${index}]`), at = `lens ${String(lens.id)}`;
    if (typeof lens.id !== 'string') throw new TypeError(`${objectId}: prepared lenses.controls[${index}].id must be a string, not ${JSON.stringify(lens.id)}.`);
    const volume = lens.volume === undefined ? undefined : record(objectId, lens.volume, `${at}.volume`);
    if (lens.view === 'interior' || (volume && volume.surface !== lens.id)) return;
    add(profile.surface.surface.url, urls(objectId, lens, ['surfaceUrl', 'surface2xUrl'], at).flatMap(surfaceFiles));
    add(profile.surface.poles.url, urls(objectId, lens, ['polesUrl', 'poles2xUrl'], at));
  });
  if (profile.cutaway) {
    const images = record(objectId, interior, 'prepared interior');
    // The cutaway's patches name each image by its `Url` field (cutaway.ts); the `2xUrl` field may name another file.
    const image = (name: InteriorImage) => {
      const [key] = urls(objectId, images, [`${name}Url`], 'prepared interior');
      if (!key) throw new TypeError(`${objectId}: prepared interior.${name}Url is missing.`);
      return { key, found: [key, ...urls(objectId, images, [`${name}2xUrl`], 'prepared interior')] };
    };
    add(profile.surface.surface.url, [...image('outerSurface').found, ...image('outerSurfaceUnlit').found]);
    add(image('outerPoles').key, [...image('outerPoles').found, ...image('outerPolesUnlit').found]);
    for (const name of ['core', 'corePoles', 'section'] as const) add(image(name).key, image(name).found);
  }
  return new Map([...candidates].map(([key, images]) => [key, [...images]]));
}

/** Measures each candidate once and answers every leaf url with the width of the widest image that can stand in it. */
export async function widestLeafImages(objectId: string, candidates: ReadonlyMap<string, readonly string[]>, width: (url: string) => Promise<number>): Promise<LeafImagePixels> {
  const measured = new Map(await Promise.all([...new Set([...candidates.values()].flat())].map(async url => {
    const value = await width(url);
    if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`${objectId}: leaf image ${url} measures ${value} px wide; a published image has a positive whole width.`);
    return [url, value] as const;
  })));
  const widest = new Map([...candidates].map(([url, images]) => {
    if (!images.length) throw new TypeError(`${objectId}: leaf texture ${url} has no published image.`);
    return [url, Math.max(...images.map(image => measured.get(image)!))] as const;
  }));
  return url => {
    const value = widest.get(url);
    if (value === undefined) throw new TypeError(`${objectId}: a leaf names ${url}, which is none of the measured leaf textures (${[...widest.keys()].join(', ')}).`);
    return value;
  };
}
