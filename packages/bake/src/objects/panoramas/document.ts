/** A body's surface panoramas: finished 360° images from a surface camera, placed by the rover localisation of their sols. */
export const SURFACE_PANORAMAS_SCHEMA = 'cssearth-surface-panoramas@1';

/** How the published images map to directions: a cylinder with one scale in both axes, as the publisher states it. */
export interface PanoramaProjection {
  /** The publisher's own sentence, kept so the placement can be checked against it. */
  readonly quote: string;
  readonly quoteUrl: string;
  /** Azimuth, clockwise from north, at the image's horizontal centre. */
  readonly azimuthAtCentreDeg: number;
  /** Elevation of the image's top row. */
  readonly topElevationDeg: number;
}

export interface SurfacePanorama {
  readonly id: string;
  readonly title: string;
  /** First and last sol of the images, inclusive. */
  readonly sols: readonly [number, number];
  readonly camera: string;
  /** The source image, a manifest input path under `source/`. */
  readonly image: string;
  readonly credit: string;
  readonly pageUrl: string;
}

export interface SurfacePanoramas {
  readonly schema: typeof SURFACE_PANORAMAS_SCHEMA;
  readonly source: string;
  readonly sourcePage: string;
  readonly retrievedAt: string;
  readonly projection: PanoramaProjection;
  /** The rover localisation table that places each panorama by its sols: a PDS PLACES CSV under `source/`. */
  readonly localization: { readonly path: string; readonly product: string };
  readonly panoramas: readonly SurfacePanorama[];
}

const record = (value: unknown, label: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError(`${label} must be an object.`);
  return value as Record<string, unknown>;
};
const text = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} must be a non-empty string.`);
  return value;
};
const url = (value: unknown, label: string): string => {
  const link = text(value, label);
  if (!/^https:\/\//u.test(link)) throw new TypeError(`${label} must be an https URL, not ${link}.`);
  return link;
};
const finite = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${label} must be a finite number.`);
  return value;
};
const only = (value: Record<string, unknown>, keys: readonly string[], label: string) => {
  const extra = Object.keys(value).filter(key => !keys.includes(key));
  if (extra.length) throw new TypeError(`${label} has unsupported fields: ${extra.join(', ')}.`);
};

export function parseSurfacePanoramas(value: unknown): SurfacePanoramas {
  const input = record(value, 'surface panoramas');
  only(input, ['schema', 'source', 'sourcePage', 'retrievedAt', 'projection', 'localization', 'panoramas'], 'surface panoramas');
  if (input.schema !== SURFACE_PANORAMAS_SCHEMA) throw new TypeError(`Surface panoramas schema must be ${SURFACE_PANORAMAS_SCHEMA}.`);
  const retrievedAt = text(input.retrievedAt, 'retrievedAt');
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(retrievedAt)) throw new TypeError('retrievedAt must be an ISO date.');
  const projectionInput = record(input.projection, 'projection');
  only(projectionInput, ['quote', 'quoteUrl', 'azimuthAtCentreDeg', 'topElevationDeg'], 'projection');
  const projection: PanoramaProjection = Object.freeze({ quote: text(projectionInput.quote, 'projection.quote'), quoteUrl: url(projectionInput.quoteUrl, 'projection.quoteUrl'),
    azimuthAtCentreDeg: finite(projectionInput.azimuthAtCentreDeg, 'projection.azimuthAtCentreDeg'), topElevationDeg: finite(projectionInput.topElevationDeg, 'projection.topElevationDeg') });
  if (Math.abs(projection.topElevationDeg) >= 90) throw new TypeError('projection.topElevationDeg must lie between -90 and 90.');
  if (!Array.isArray(input.panoramas) || !input.panoramas.length) throw new TypeError('panoramas must list at least one panorama.');
  const ids = new Set<string>();
  const panoramas = input.panoramas.map((item, index) => {
    const label = `panoramas[${index}]`, entry = record(item, label);
    only(entry, ['id', 'title', 'sols', 'camera', 'image', 'credit', 'pageUrl'], label);
    const id = text(entry.id, `${label}.id`);
    if (!/^[a-z][a-z0-9-]*$/u.test(id) || ids.has(id)) throw new TypeError(`${label}.id must be a unique kebab id, not ${id}.`);
    ids.add(id);
    if (!Array.isArray(entry.sols) || entry.sols.length !== 2 || !entry.sols.every(sol => Number.isInteger(sol) && sol >= 0) || entry.sols[0] > entry.sols[1]) {
      throw new TypeError(`${label}.sols must be [first, last] whole sols.`);
    }
    const image = text(entry.image, `${label}.image`);
    if (image.startsWith('/') || image.split('/').includes('..')) throw new TypeError(`${label}.image must stay inside the source directory.`);
    return Object.freeze({ id, title: text(entry.title, `${label}.title`), sols: Object.freeze([entry.sols[0], entry.sols[1]] as const), camera: text(entry.camera, `${label}.camera`),
      image, credit: text(entry.credit, `${label}.credit`), pageUrl: url(entry.pageUrl, `${label}.pageUrl`) });
  });
  const localizationInput = record(input.localization, 'localization');
  only(localizationInput, ['path', 'product'], 'localization');
  const localizationPath = text(localizationInput.path, 'localization.path');
  if (localizationPath.startsWith('/') || localizationPath.split('/').includes('..')) throw new TypeError('localization.path must stay inside the source directory.');
  return Object.freeze({ schema: SURFACE_PANORAMAS_SCHEMA, source: text(input.source, 'source'), sourcePage: url(input.sourcePage, 'sourcePage'), retrievedAt, projection,
    localization: Object.freeze({ path: localizationPath, product: url(localizationInput.product, 'localization.product') }), panoramas: Object.freeze(panoramas) });
}
