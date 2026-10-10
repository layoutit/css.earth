/** What the plates panel reads from an image-layer object's tracked records: the registered photograph, the published
 * geometry its plates follow and the paper that publishes it. The browser only reads; the bake reads the same recipe. */
import { isRecord } from '@cssearth/core';

const ARCSEC_PER_RADIAN = 180 * 3600 / Math.PI;
export interface PlatePhotograph {
  path: string; width: number; height: number; publisherUrl?: string; credit: string; license?: string;
  /** The tracked account of how the photograph was registered (the source manifest's acquisition text). */
  registration?: string;
}
/** The pictures of one dataset the panel can show, as paths in its `source/` directory: the photograph as published
 * (`original`, with its stars) and, when the bake reads a star-free copy, that copy (`starless`). Both share the
 * recipe's frame. `starlessReason` says why there is no star-free file. */
export interface PlatePictures { original?: string; starless?: string; starlessReason?: string }
export interface Plate {
  id: 'disc' | 'ring'; label: string; radiusArcsec: number; tiltDeg: number; farAxisPaDeg: number;
  /** How far in front of and behind the star the plate's edge lies along the sight line: radius × sin(tilt). */
  depthArcsec: number;
}
export interface PlateGeometry {
  kind: string; source: string; basis: string; plates: Plate[]; lineOfSightThicknessArcsec?: number;
}
export interface PlateRecipe {
  id: string; photograph: PlatePhotograph; pictures: PlatePictures; distancePc: number;
  observation: { centerRaDeg: number; centerDecDeg: number; fieldOfViewDeg: [number, number]; northClockwiseDeg: number };
  target: { raDeg: number; decDeg: number };
  /** The recipe's published geometry: its rings as plates, or its other kinds named with their source. */
  geometry: PlateGeometry[];
  /** A recipe that reads a window of a larger photograph has no single frame to draw guides on. */
  cropped: boolean;
}
export interface Publication { id: string; title: string; creators: string[]; publisher?: string; year?: string; url?: string; doi?: string }

const finite = (value: unknown, name: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`Image-layer recipe ${name} must be a finite number.`);
  return value;
};
const text = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`Image-layer recipe ${name} must be text.`);
  return value;
};
const GEOMETRY_KINDS = ['rings', 'shape', 'body', 'surface', 'densityGrid', 'collision', 'ellipsoid', 'streams', 'bulge'] as const;

export function readPlateRecipe(value: unknown, manifest?: unknown): PlateRecipe {
  // The bake owns the recipe's schema and validates it; the panel reads only the fields it shows.
  if (!isRecord(value) || typeof value.schema !== 'string') throw new TypeError('Expected an image-layer recipe.');
  const source = value.source, observation = value.observation, target = value.target, geometry = value.geometry;
  if (!isRecord(source) || !isRecord(observation) || !isRecord(target) || !isRecord(geometry)) throw new TypeError('Image-layer recipe is incomplete.');
  const dimensions = source.dimensions, field = observation.fieldOfViewDeg;
  if (!Array.isArray(dimensions) || dimensions.length !== 2 || !Array.isArray(field) || field.length !== 2) throw new TypeError('Image-layer recipe frame is incomplete.');
  const path = text(source.path, 'source.path');
  const inputs = isRecord(manifest) && Array.isArray(manifest.inputs) ? manifest.inputs : [];
  const input = inputs.find(item => isRecord(item) && typeof item.path === 'string' && item.path.endsWith(`/source/${path}`));
  const registration = isRecord(input) && typeof input.acquisition === 'string' ? input.acquisition : undefined;
  const pictures = platePictures(path, inputs, source.foregroundStars !== undefined);
  const plates: PlateGeometry[] = [];
  for (const kind of GEOMETRY_KINDS) {
    const item = geometry[kind];
    if (item === undefined) continue;
    const record = isRecord(item) ? item : {};
    if (kind === 'rings') plates.push(readRings(record));
    else plates.push({ kind, source: typeof record.source === 'string' ? record.source : '', basis: typeof record.basis === 'string' ? record.basis : '', plates: [] });
  }
  return { id: text(value.id, 'id'), distancePc: finite(target.distancePc, 'target.distancePc'),
    photograph: { path, width: finite(dimensions[0], 'source.dimensions'), height: finite(dimensions[1], 'source.dimensions'),
      credit: text(source.credit, 'source.credit'), ...(typeof source.publisherUrl === 'string' ? { publisherUrl: source.publisherUrl } : {}),
      ...(typeof source.license === 'string' ? { license: source.license } : {}), ...(registration ? { registration } : {}) },
    observation: { centerRaDeg: finite(observation.centerRaDeg, 'observation.centerRaDeg'), centerDecDeg: finite(observation.centerDecDeg, 'observation.centerDecDeg'),
      fieldOfViewDeg: [finite(field[0], 'observation.fieldOfViewDeg'), finite(field[1], 'observation.fieldOfViewDeg')],
      northClockwiseDeg: finite(observation.northClockwiseDeg, 'observation.northClockwiseDeg') },
    target: { raDeg: finite(target.centerRaDeg, 'target.centerRaDeg'), decDeg: finite(target.centerDecDeg, 'target.centerDecDeg') },
    pictures, geometry: plates, cropped: source.parentPixelWindow !== undefined };
}
/** Pictures a browser can show: the published JPEGs and PNGs, not an original TIFF. */
const SHOWN = /\.(?:jpe?g|png|webp)$/i;
/** Which files of the source manifest are the published photograph and the star-free copy the bake reads. A recipe
 * picture that `remove-stars` writes is the star-free copy, and the manifest's `original` input is the photograph it
 * was made from. Any other recipe picture is the photograph itself, or that photograph laid on the bank's frame
 * (the Helix's ESO pictures, whose TIFF originals a browser cannot show). */
export function platePictures(path: string, inputs: readonly unknown[], removesCataloguedStars: boolean): PlatePictures {
  const inputOf = (test: (item: Record<string, unknown>) => boolean) => inputs.find((item): item is Record<string, unknown> => isRecord(item) && test(item));
  const local = (item: Record<string, unknown> | undefined) => {
    const file = typeof item?.path === 'string' ? item.path.split('/source/').at(-1) : undefined;
    return file && SHOWN.test(file) ? file : undefined;
  };
  // Without the manifest nothing says whether the recipe's picture still has its stars.
  if (!inputs.length) return {};
  const optical = inputOf(item => typeof item.path === 'string' && item.path.endsWith(`/source/${path}`));
  if (typeof optical?.generator === 'string' && optical.generator.includes('remove-stars')) {
    const original = local(inputOf(item => item.id === 'original'));
    return { starless: path, ...(original ? { original } : {}) };
  }
  return { original: path, starlessReason: removesCataloguedStars
    ? 'The bake removes the catalogued foreground stars itself, while it bakes; no star-free file is kept.'
    : 'This dataset is baked from the photograph as published; no star-free copy exists.' };
}
function readRings(rings: Record<string, unknown>): PlateGeometry {
  const plate = (id: 'disc' | 'ring', label: string): Plate => {
    const value = rings[id];
    if (!isRecord(value)) throw new TypeError(`geometry.rings.${id} is missing.`);
    const radiusArcsec = finite(value.radiusArcsec, `geometry.rings.${id}.radiusArcsec`), tiltDeg = finite(value.tiltDeg, `geometry.rings.${id}.tiltDeg`);
    return { id, label, radiusArcsec, tiltDeg, farAxisPaDeg: finite(value.farAxisPaDeg, `geometry.rings.${id}.farAxisPaDeg`),
      depthArcsec: radiusArcsec * Math.sin(tiltDeg * Math.PI / 180) };
  };
  return { kind: 'rings', source: text(rings.source, 'geometry.rings.source'), basis: text(rings.basis, 'geometry.rings.basis'),
    plates: [plate('disc', 'Inner disc'), plate('ring', 'Outer ring')],
    ...(rings.lineOfSightThicknessArcsec === undefined ? {} : { lineOfSightThicknessArcsec: finite(rings.lineOfSightThicknessArcsec, 'geometry.rings.lineOfSightThicknessArcsec') }) };
}

export function readPublication(value: unknown): Publication {
  if (!isRecord(value) || value.kind !== 'publication' || typeof value.id !== 'string' || typeof value.title !== 'string') throw new TypeError('Expected a publication source record.');
  const identifiers = Array.isArray(value.identifiers) ? value.identifiers.filter(isRecord) : [];
  const doi = identifiers.find(item => item.type === 'doi' && typeof item.value === 'string')?.value as string | undefined;
  const link = Array.isArray(value.links) ? value.links.find(item => isRecord(item) && typeof item.url === 'string') : undefined;
  return { id: value.id, title: value.title, creators: Array.isArray(value.creators) ? value.creators.filter((item): item is string => typeof item === 'string') : [],
    ...(typeof value.publisher === 'string' ? { publisher: value.publisher } : {}),
    ...(typeof value.publicationDate === 'string' ? { year: value.publicationDate.slice(0, 4) } : {}),
    ...(doi ? { doi, url: `https://doi.org/${doi}` } : isRecord(link) && typeof link.url === 'string' ? { url: link.url } : {}) };
}
/** "O'Dell, McCullough & Meixner (2004)". */
export function citation(publication: Publication): string {
  const names = publication.creators.map(name => name.split(',')[0]!.trim());
  const authors = names.length > 3 ? `${names[0]} et al.` : names.length > 1 ? `${names.slice(0, -1).join(', ')} & ${names.at(-1)}` : names[0] ?? publication.title;
  return publication.year ? `${authors} (${publication.year})` : authors;
}

/** One arcsecond of sky at the recipe's distance, in parsecs. */
export const parsecsPerArcsec = (distancePc: number) => distancePc / ARCSEC_PER_RADIAN;

/** The photograph's pixel at a sky offset from its field centre (east, north, arcseconds), by the recipe's field and
 * north angle: the bake's own frame (`imageLayerView`), on a field small enough to be flat. */
export function photographPixel(recipe: PlateRecipe, east: number, north: number): [number, number] {
  const { observation: o, photograph: p } = recipe, theta = o.northClockwiseDeg * Math.PI / 180;
  const right = north * Math.sin(theta) - east * Math.cos(theta), up = north * Math.cos(theta) + east * Math.sin(theta);
  return [p.width / 2 + right / (o.fieldOfViewDeg[0] * 3600 / p.width), p.height / 2 - up / (o.fieldOfViewDeg[1] * 3600 / p.height)];
}
/** A plate's outline on the photograph: the circle of its radius, tilted about its line of nodes, seen from the Sun. */
export function plateOutline(recipe: PlateRecipe, plate: Plate) {
  const cosDec = Math.cos(recipe.observation.centerDecDeg * Math.PI / 180);
  const east = (recipe.target.raDeg - recipe.observation.centerRaDeg) * cosDec * 3600, north = (recipe.target.decDeg - recipe.observation.centerDecDeg) * 3600;
  const centre = photographPixel(recipe, east, north);
  // The line of nodes is perpendicular to the far axis; along it the circle keeps its radius.
  const nodes = (plate.farAxisPaDeg + 90) * Math.PI / 180;
  const end = photographPixel(recipe, east + plate.radiusArcsec * Math.sin(nodes), north + plate.radiusArcsec * Math.cos(nodes));
  const major = Math.hypot(end[0] - centre[0], end[1] - centre[1]);
  return { cx: centre[0], cy: centre[1], rx: major, ry: major * Math.cos(plate.tiltDeg * Math.PI / 180),
    rotationDeg: Math.atan2(end[1] - centre[1], end[0] - centre[0]) * 180 / Math.PI };
}

/** An editable number of a recipe's published geometry: its dotted path, the structure it belongs to, and its name. */
export interface GeometryField { path: string; group: string; key: string; value: number; min: number; max: number; step: number }
/** Every number under `geometry` a published-plates edit may change. Column numbers of a table and long lists stay out:
 * they name inputs rather than shape the plates. */
export function geometryFields(recipe: unknown): GeometryField[] {
  if (!isRecord(recipe) || !isRecord(recipe.geometry)) return [];
  const fields: GeometryField[] = [];
  const walk = (node: unknown, path: string[]) => {
    if (typeof node === 'number' && Number.isFinite(node)) {
      const key = path.at(-1)!, indexed = /^\d+$/.test(key), label = indexed ? `${path.at(-2)}[${key}]` : key;
      const parents = path.slice(0, indexed ? -2 : -1), group = parents.length ? parents.join(' · ') : 'frame';
      fields.push({ path: ['geometry', ...path].join('.'), group, key: label, value: node, ...range(label, node) });
    } else if (Array.isArray(node)) { if (node.length <= 4) node.forEach((item, index) => walk(item, [...path, String(index)])); }
    else if (isRecord(node)) for (const [key, value] of Object.entries(node)) if (key !== 'columns') walk(value, [...path, key]);
  };
  walk(recipe.geometry, []);
  return fields;
}
/** The slider-edited numbers of a recipe, by dotted path. */
export type GeometryValues = Record<string, number>;
export const geometryValues = (recipe: unknown): GeometryValues => Object.fromEntries(geometryFields(recipe).map(field => [field.path, field.value]));
/** The writes that bring `current`'s geometry numbers back to `target`: only numbers both name, only where they differ. */
export function geometryRestore(current: GeometryValues, target: GeometryValues) {
  return Object.entries(target).filter(([path, value]) => path in current && current[path] !== value).map(([path, value]) => ({ path, value }));
}
function range(key: string, value: number): { min: number; max: number; step: number } {
  if (/tilt|inclination/i.test(key) && /Deg/.test(key)) return { min: 0, max: 89.9, step: .5 };
  if (/Deg/.test(key)) return { min: Math.min(-360, value), max: Math.max(360, value), step: 1 };
  if (/Arcsec/.test(key)) return { min: 0, max: Math.max(2 * Math.abs(value), 1), step: Math.abs(value) >= 20 ? 1 : .1 };
  const magnitude = Math.abs(value) || 1;
  return { min: value >= 0 ? 0 : -4 * magnitude, max: 4 * magnitude, step: Number.isInteger(value) && magnitude >= 4 ? 1 : magnitude / 100 };
}
/** Outlines drawn on the photograph: each rings plate, and each published ellipse (a semi-major and semi-minor axis
 * and the major axis's position angle) in the geometry. */
export function photographOutlines(recipe: PlateRecipe, raw: unknown): { id: string; cx: number; cy: number; rx: number; ry: number; rotationDeg: number }[] {
  const outlines: { id: string; cx: number; cy: number; rx: number; ry: number; rotationDeg: number }[] = recipe.geometry.flatMap(item => item.plates.map(plate => ({ id: plate.id, ...plateOutline(recipe, plate) })));
  const geometry = isRecord(raw) && isRecord(raw.geometry) ? raw.geometry : {};
  const visit = (node: unknown, name: string) => {
    if (!isRecord(node)) return;
    const { semiMajorArcsec: a, semiMinorArcsec: b, majorPaDeg: pa } = node;
    if (typeof a === 'number' && typeof b === 'number' && typeof pa === 'number' && a > 0 && b > 0) {
      // A circle of the major radius tilted to show the minor one: the same outline as a plate whose far axis is 90° from the major axis.
      const outline = plateOutline(recipe, { id: 'disc', label: name, radiusArcsec: a, tiltDeg: Math.acos(Math.min(1, b / a)) * 180 / Math.PI, farAxisPaDeg: pa - 90, depthArcsec: 0 });
      outlines.push({ id: name, ...outline });
    }
    for (const [key, value] of Object.entries(node)) if (key !== 'rings') visit(value, key);
  };
  for (const [key, value] of Object.entries(geometry)) if (key !== 'rings') visit(value, key);
  return outlines;
}

/** A table of measured speeds the bake places features with (`geometry.shape.speeds`): its file in `source/` and
 * the columns of each row's place east and north of the star (arcsec) and its speed along the sight line (km/s). */
export interface SpeedTable { path: string; source: string; columns: { east: number; north: number; kmS: number } }
export function speedTable(raw: unknown): SpeedTable | null {
  const shape = isRecord(raw) && isRecord(raw.geometry) && isRecord(raw.geometry.shape) ? raw.geometry.shape : null;
  const speeds = shape && isRecord(shape.speeds) ? shape.speeds : null, columns = speeds && isRecord(speeds.columns) ? speeds.columns : null;
  if (!speeds || !columns || typeof speeds.path !== 'string') return null;
  const column = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
  const east = column(columns.east), north = column(columns.north), kmS = column(columns.kmS);
  if (east === null || north === null || kmS === null) return null;
  return { path: speeds.path, source: typeof speeds.source === 'string' ? speeds.source : '', columns: { east, north, kmS } };
}
/** A measured point on the photograph: its pixel, and its speed along the sight line (positive recedes, behind the
 * star; negative approaches, in front), as the bake splits them. */
export interface SpeedPoint { x: number; y: number; kmS: number }
/** The rows of a speed table on the photograph, read as the bake reads them (whitespace-separated numbers). A table
 * longer than `most` rows is shown one row in every `stride`, evenly. */
export function speedPoints(recipe: PlateRecipe, table: SpeedTable, text: string, most = 12000): { points: SpeedPoint[]; rows: number; stride: number; maxKmS: number } {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  const stride = Math.max(1, Math.ceil(lines.length / most)), points: SpeedPoint[] = [];
  const cosDec = Math.cos(recipe.observation.centerDecDeg * Math.PI / 180);
  const starEast = (recipe.target.raDeg - recipe.observation.centerRaDeg) * cosDec * 3600, starNorth = (recipe.target.decDeg - recipe.observation.centerDecDeg) * 3600;
  let maxKmS = 0;
  for (let index = 0; index < lines.length; index += stride) {
    const cells = lines[index]!.trim().split(/\s+/).map(Number);
    const east = cells[table.columns.east], north = cells[table.columns.north], kmS = cells[table.columns.kmS];
    if (!Number.isFinite(east) || !Number.isFinite(north) || !Number.isFinite(kmS)) throw new TypeError(`${table.path} row ${index + 1} has no east, north and speed columns.`);
    const [x, y] = photographPixel(recipe, starEast + east!, starNorth + north!);
    points.push({ x, y, kmS: kmS! }); maxKmS = Math.max(maxKmS, Math.abs(kmS!));
  }
  return { points, rows: lines.length, stride, maxKmS };
}
