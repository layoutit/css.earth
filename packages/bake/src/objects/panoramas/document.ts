/** A body's surface panoramas: finished 360° images from a surface camera, each placed where it was taken and turned to
 * the directions it shows, either as its publisher states the projection or by tie points measured in the image. */
export const SURFACE_PANORAMAS_SCHEMA = 'cssearth-surface-panoramas@2';

/** The publisher states the projection: a cylinder with one scale in both axes whose width spans 360°. */
export interface StatedCylinderPlacement {
  readonly kind: 'stated-cylinder';
  /** The publisher's own sentence, kept so the placement can be checked against it. */
  readonly quote: string;
  readonly quoteUrl: string;
  /** Azimuth, clockwise from north, at the image's horizontal centre. */
  readonly azimuthAtCentreDeg: number;
  /** Elevation of the image's top row. */
  readonly topElevationDeg: number;
}

/** No projection is published: each panorama is turned by tie points (the Sun, the photographer's shadow opposite it, and
 * hardware mapped from orbit) and levelled on its terrain horizon. */
export interface TiePointPlacement {
  readonly kind: 'tie-points';
  /** Height of the camera above the ground, metres, and why. It moves only the nearest part of the horizon. */
  readonly cameraHeightM: number;
  readonly cameraHeightNote: string;
}

export type PanoramaPlacement = StatedCylinderPlacement | TiePointPlacement;

/** Where the camera stood: a rover localisation table read by sols, or the LROC Apollo photograph layer. */
export type PanoramaLocalization =
  | { readonly kind: 'places'; readonly path: string; readonly product: string }
  | { readonly kind: 'lroc-hasselblad'; readonly product: string };

export interface PanoramaTie {
  /** Column of the published image, in its own pixels, where the tie's direction is. */
  readonly column: number;
  readonly kind: 'sun' | 'antisun' | 'equipment';
  /** The hardware's name in the mission's LROC equipment layer. */
  readonly equipment?: string;
}

export interface SurfacePanorama {
  readonly id: string;
  readonly title: string;
  /** When it was taken, as the list shows it ("Sols 3–11", "21 July 1969"). */
  readonly when: string;
  readonly camera: string;
  /** The source image, a manifest input path under `source/`. */
  readonly image: string;
  readonly credit: string;
  readonly pageUrl: string;
  /** First and last sol of the images, inclusive: the rover localisation reads them. */
  readonly sols?: readonly [number, number];
  /** The LROC photograph record: the mission archive, its Hasselblad and equipment layers, one frame of the panorama, and
   * the mission's range zero its ground elapsed times count from. */
  readonly photos?: { readonly archive: string; readonly layer: string; readonly equipment: string; readonly magazine: string; readonly frame: string;
    readonly rangeZero: { readonly utc: string; readonly source: string };
    /** The largest error its mappers publish for the standpoint and hardware points, and where they say so. */
    readonly positionError?: { readonly metres: number; readonly source: string } };
  /** The terrain model its horizon is levelled on, a manifest input path under `source/`. */
  readonly terrain?: string;
  /** The Sun's sub-solar point on the body at the photograph's time, read from the recorded query. */
  readonly subsolar?: { readonly utc: string; readonly longitudeDegEast: number; readonly latitudeDeg: number; readonly query: string };
  readonly ties?: readonly PanoramaTie[];
}

export interface SurfacePanoramas {
  readonly schema: typeof SURFACE_PANORAMAS_SCHEMA;
  readonly source: string;
  readonly sourcePage: string;
  readonly retrievedAt: string;
  readonly placement: PanoramaPlacement;
  readonly localization: PanoramaLocalization;
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
const inside = (value: unknown, label: string): string => {
  const path = text(value, label);
  if (path.startsWith('/') || path.split('/').includes('..')) throw new TypeError(`${label} must stay inside the source directory.`);
  return path;
};
const only = (value: Record<string, unknown>, keys: readonly string[], label: string) => {
  const extra = Object.keys(value).filter(key => !keys.includes(key));
  if (extra.length) throw new TypeError(`${label} has unsupported fields: ${extra.join(', ')}.`);
};

function placement(value: unknown): PanoramaPlacement {
  const input = record(value, 'placement');
  if (input.kind === 'stated-cylinder') {
    only(input, ['kind', 'quote', 'quoteUrl', 'azimuthAtCentreDeg', 'topElevationDeg'], 'placement');
    const top = finite(input.topElevationDeg, 'placement.topElevationDeg');
    if (Math.abs(top) >= 90) throw new TypeError('placement.topElevationDeg must lie between -90 and 90.');
    return Object.freeze({ kind: 'stated-cylinder', quote: text(input.quote, 'placement.quote'), quoteUrl: url(input.quoteUrl, 'placement.quoteUrl'),
      azimuthAtCentreDeg: finite(input.azimuthAtCentreDeg, 'placement.azimuthAtCentreDeg'), topElevationDeg: top });
  }
  if (input.kind === 'tie-points') {
    only(input, ['kind', 'cameraHeightM', 'cameraHeightNote'], 'placement');
    const height = finite(input.cameraHeightM, 'placement.cameraHeightM');
    if (height <= 0 || height > 5) throw new TypeError('placement.cameraHeightM must be a camera height in metres.');
    return Object.freeze({ kind: 'tie-points', cameraHeightM: height, cameraHeightNote: text(input.cameraHeightNote, 'placement.cameraHeightNote') });
  }
  throw new TypeError(`placement.kind must be stated-cylinder or tie-points, not ${String(input.kind)}.`);
}

function localization(value: unknown): PanoramaLocalization {
  const input = record(value, 'localization');
  if (input.kind === 'places') { only(input, ['kind', 'path', 'product'], 'localization'); return Object.freeze({ kind: 'places', path: inside(input.path, 'localization.path'), product: url(input.product, 'localization.product') }); }
  if (input.kind === 'lroc-hasselblad') { only(input, ['kind', 'product'], 'localization'); return Object.freeze({ kind: 'lroc-hasselblad', product: url(input.product, 'localization.product') }); }
  throw new TypeError(`localization.kind must be places or lroc-hasselblad, not ${String(input.kind)}.`);
}

function panorama(item: unknown, index: number, place: PanoramaPlacement, locate: PanoramaLocalization): SurfacePanorama {
  const label = `panoramas[${index}]`, entry = record(item, label);
  only(entry, ['id', 'title', 'when', 'camera', 'image', 'credit', 'pageUrl', 'sols', 'photos', 'terrain', 'subsolar', 'ties'], label);
  const id = text(entry.id, `${label}.id`);
  if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError(`${label}.id must be a kebab id, not ${id}.`);
  const base = { id, title: text(entry.title, `${label}.title`), when: text(entry.when, `${label}.when`), camera: text(entry.camera, `${label}.camera`),
    image: inside(entry.image, `${label}.image`), credit: text(entry.credit, `${label}.credit`), pageUrl: url(entry.pageUrl, `${label}.pageUrl`) };
  const extra: Record<string, unknown> = {};
  if (locate.kind === 'places') {
    const sols = entry.sols;
    if (!Array.isArray(sols) || sols.length !== 2 || !sols.every(sol => Number.isInteger(sol) && sol >= 0) || sols[0] > sols[1]) throw new TypeError(`${label}.sols must be [first, last] whole sols.`);
    extra.sols = Object.freeze([sols[0], sols[1]] as const);
  } else {
    const photos = record(entry.photos, `${label}.photos`);
    only(photos, ['archive', 'layer', 'equipment', 'magazine', 'frame', 'rangeZero', 'positionError'], `${label}.photos`);
    let positionError: { metres: number; source: string } | undefined;
    if (photos.positionError !== undefined) {
      const error = record(photos.positionError, `${label}.photos.positionError`);
      only(error, ['metres', 'source'], `${label}.photos.positionError`);
      const metres = finite(error.metres, `${label}.photos.positionError.metres`);
      if (metres <= 0) throw new TypeError(`${label}.photos.positionError.metres must be positive.`);
      positionError = Object.freeze({ metres, source: url(error.source, `${label}.photos.positionError.source`) });
    }
    const zero = record(photos.rangeZero, `${label}.photos.rangeZero`);
    only(zero, ['utc', 'source'], `${label}.photos.rangeZero`);
    const zeroUtc = text(zero.utc, `${label}.photos.rangeZero.utc`);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(zeroUtc)) throw new TypeError(`${label}.photos.rangeZero.utc must be YYYY-MM-DDTHH:MM:SSZ.`);
    extra.photos = Object.freeze({ archive: inside(photos.archive, `${label}.photos.archive`), layer: text(photos.layer, `${label}.photos.layer`),
      equipment: text(photos.equipment, `${label}.photos.equipment`), magazine: text(photos.magazine, `${label}.photos.magazine`), frame: text(photos.frame, `${label}.photos.frame`),
      rangeZero: Object.freeze({ utc: zeroUtc, source: url(zero.source, `${label}.photos.rangeZero.source`) }), ...(positionError ? { positionError } : {}) });
  }
  if (place.kind === 'tie-points') {
    extra.terrain = inside(entry.terrain, `${label}.terrain`);
    const sun = record(entry.subsolar, `${label}.subsolar`);
    only(sun, ['utc', 'longitudeDegEast', 'latitudeDeg', 'query'], `${label}.subsolar`);
    const utc = text(sun.utc, `${label}.subsolar.utc`);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/u.test(utc)) throw new TypeError(`${label}.subsolar.utc must be YYYY-MM-DDTHH:MMZ.`);
    extra.subsolar = Object.freeze({ utc, longitudeDegEast: finite(sun.longitudeDegEast, `${label}.subsolar.longitudeDegEast`), latitudeDeg: finite(sun.latitudeDeg, `${label}.subsolar.latitudeDeg`),
      query: url(sun.query, `${label}.subsolar.query`) });
    if (!Array.isArray(entry.ties) || entry.ties.length < 2) throw new TypeError(`${label}.ties must list at least two tie points.`);
    extra.ties = Object.freeze(entry.ties.map((value, at) => {
      const tie = record(value, `${label}.ties[${at}]`);
      only(tie, ['column', 'kind', 'equipment'], `${label}.ties[${at}]`);
      const column = finite(tie.column, `${label}.ties[${at}].column`);
      if (tie.kind !== 'sun' && tie.kind !== 'antisun' && tie.kind !== 'equipment') throw new TypeError(`${label}.ties[${at}].kind must be sun, antisun or equipment.`);
      if ((tie.kind === 'equipment') !== (tie.equipment !== undefined)) throw new TypeError(`${label}.ties[${at}] names equipment exactly when it is an equipment tie.`);
      return Object.freeze({ column, kind: tie.kind, ...(tie.equipment === undefined ? {} : { equipment: text(tie.equipment, `${label}.ties[${at}].equipment`) }) });
    }));
    if (!(extra.ties as readonly PanoramaTie[]).some(tie => tie.kind !== 'equipment')) throw new TypeError(`${label}.ties need the Sun or the shadow opposite it: hardware alone depends on the standpoint.`);
  }
  return Object.freeze({ ...base, ...extra }) as SurfacePanorama;
}

export function parseSurfacePanoramas(value: unknown): SurfacePanoramas {
  const input = record(value, 'surface panoramas');
  only(input, ['schema', 'source', 'sourcePage', 'retrievedAt', 'placement', 'localization', 'panoramas'], 'surface panoramas');
  if (input.schema !== SURFACE_PANORAMAS_SCHEMA) throw new TypeError(`Surface panoramas schema must be ${SURFACE_PANORAMAS_SCHEMA}.`);
  const retrievedAt = text(input.retrievedAt, 'retrievedAt');
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(retrievedAt)) throw new TypeError('retrievedAt must be an ISO date.');
  const place = placement(input.placement), locate = localization(input.localization);
  if (!Array.isArray(input.panoramas) || !input.panoramas.length) throw new TypeError('panoramas must list at least one panorama.');
  const panoramas = input.panoramas.map((item, index) => panorama(item, index, place, locate));
  const ids = panoramas.map(entry => entry.id);
  if (new Set(ids).size !== ids.length) throw new TypeError('panorama ids must be unique.');
  return Object.freeze({ schema: SURFACE_PANORAMAS_SCHEMA, source: text(input.source, 'source'), sourcePage: url(input.sourcePage, 'sourcePage'), retrievedAt,
    placement: place, localization: locate, panoramas: Object.freeze(panoramas) });
}
