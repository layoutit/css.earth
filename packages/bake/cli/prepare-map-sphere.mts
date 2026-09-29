/**
 * Prepare an all-sky HEALPix map as a sphere of image patches around the Sun, seen from outside: the cosmic microwave
 * background at the distance its light left from. `source/<id>/sphere.json` names the map (its FITS file, column and
 * coordinate system), the colour table and the value range it is drawn over, and the sphere's radius as a redshift
 * turned into a comoving distance in the Planck 2018 cosmology (Astropy's Planck18).
 *
 * The sphere is the planets' standard sphere (createSurfacePatches, @cssearth/objects): `latitudeSegments` bands of
 * `longitudeSegments` planar cells, ICRS north up, the top and bottom band each closed by a round polar cap
 * (POLAR_CAP_STYLE). Each patch's tile of the atlas samples the map at its texels' directions (ICRS, turned into the map's
 * Galactic coordinates), `samplesPerTexel`² samples averaged, through the same projective mapping PolyCSS draws the tile
 * with, and with a one-texel border sampled past the patch; each leaf reaches into that border, so neighbouring patches
 * overlap by a texel and no seam opens between them. The atlas goes through the lossy lane. Writes `prepared/<id>.json`
 * (`cssearth-image-mesh@1`, read by packages/renderer/src/universe/image-mesh.ts) and `prepared/<id>/<id>.webp`. A recipe
 * `cutaway` marks the patches of the hemisphere it opens; the runtime hides them and draws the rest's inside behind what
 * the sphere holds, or shows the whole sphere. Its `datasets` are the page's lenses of the sphere, whole or cut open:
 * `prepared/datasets.json` carries their card text, the colour table's legend and a picture of each view
 * (`prepared/<id>/<id>-<view>.webp`, packages/bake/src/raster/map-sphere-preview.ts).
 *
 * Usage: node packages/bake/cli/prepare-map-sphere.mts <object-directory> <id>
 */
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import sharp from 'sharp';
import { computeTextureAtlasPlanPublic, resolvePolyTextureLeafGeometry, type Polygon } from '@layoutit/polycss';
import { createSurfacePatches } from '@cssearth/objects';
import { POLAR_CAP_STYLE } from '@cssearth/bake/scene';
import { compileVolumeLeaf } from '@cssearth/bake/volume-leaves';
import { composeMapSpherePreview, encodeLossyWebp, mapSpherePreviewRays } from '@cssearth/bake/raster';
import { limbOverlay, meanObservedColour, outsideSilhouette } from '@cssearth/bake/photometry';

type Vector3 = [number, number, number];
const MPC_M = 3.0856775814913673e22;
const [objectArgument, id] = process.argv.slice(2);
if (!objectArgument || !id || !/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Usage: prepare-map-sphere.mts <object-directory> <id>');
const objectDirectory = resolve(objectArgument), sourceDirectory = resolve(objectDirectory, 'source', id), prepared = resolve(objectDirectory, 'prepared');
const recipePath = resolve(sourceDirectory, 'sphere.json');
const recipe = JSON.parse(await readFile(recipePath, 'utf8')) as {
  schema?: unknown; id?: unknown; name?: unknown; source?: unknown; meaning?: unknown;
  limb?: { law?: unknown; coefficient?: unknown; basis?: unknown };
  cutaway?: { hemisphere?: unknown; interiorOpacity?: unknown; exteriorOpacity?: unknown; basis?: unknown };
  datasets?: { default?: unknown; lenses?: unknown; legend?: { title?: unknown; meta?: unknown; stops?: unknown };
    preview?: { sizePx?: unknown; elevationDeg?: unknown; azimuthDeg?: unknown; samples?: unknown; basis?: unknown } };
  map?: { path?: unknown; origin?: unknown; column?: unknown; coordinates?: unknown; unit?: unknown };
  colourTable?: { path?: unknown; origin?: unknown; basis?: unknown; scale?: unknown; scaleBasis?: unknown; gamma?: unknown; gammaBasis?: unknown };
  range?: { min?: unknown; max?: unknown; basis?: unknown };
  radius?: { redshift?: unknown; cosmology?: unknown; basis?: unknown };
  mesh?: { latitudeSegments?: unknown; longitudeSegments?: unknown; tilePx?: unknown; samplesPerTexel?: unknown; basis?: unknown };
  epochJdTt?: unknown };
const fail = (message: string): never => { throw new TypeError(`${recipePath}: ${message}`); };
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const integer = (value: unknown, low: number, high: number): value is number => Number.isInteger(value) && (value as number) >= low && (value as number) <= high;
const { map, colourTable, range, radius, mesh, limb, cutaway, datasets } = recipe;
if (cutaway !== undefined && ((cutaway.hemisphere !== 'north' && cutaway.hemisphere !== 'south') || typeof cutaway.interiorOpacity !== 'number'
  || !(cutaway.interiorOpacity > 0 && cutaway.interiorOpacity <= 1) || typeof cutaway.exteriorOpacity !== 'number'
  || !(cutaway.exteriorOpacity > 0 && cutaway.exteriorOpacity <= 1) || !text(cutaway.basis))) {
  fail('cutaway names the hemisphere it opens (north or south), the inside wall\'s and the open shell\'s opacities in (0, 1] and a basis.');
}
// The page's datasets of the sphere: each lens shows it whole or cut open, with the card text, a picture of that view and the
// colour table's legend.
type DatasetLens = { id: string; view: 'cutaway' | 'full'; label: string; detail: string; title: string; summary: string; description: string };
const lenses: DatasetLens[] | null = datasets === undefined ? null : Array.isArray(datasets.lenses) ? datasets.lenses.map((lens: unknown) => {
  const value = lens as Partial<Record<keyof DatasetLens, unknown>> | null;
  if (!value || !/^[a-z][a-z0-9-]*$/u.test(String(value.id)) || (value.view !== 'cutaway' && value.view !== 'full')
    || !['label', 'detail', 'title', 'summary', 'description'].every(key => text(value[key as keyof DatasetLens]))) {
    return fail(`datasets.lenses: ${JSON.stringify(value?.id)} needs an id, a view (cutaway or full), label, detail, title, summary and description.`);
  }
  return value as DatasetLens;
}) : fail('datasets.lenses lists the page\'s datasets of the sphere.');
const preview = datasets?.preview, legend = datasets?.legend;
if (lenses && (!lenses.some(lens => lens.id === datasets!.default) || new Set(lenses.map(lens => lens.id)).size !== lenses.length
  || (lenses.some(lens => lens.view === 'cutaway') && !cutaway) || !preview || !integer(preview.sizePx, 32, 1024) || typeof preview.elevationDeg !== 'number'
  || !(Math.abs(preview.elevationDeg) <= 90) || typeof preview.azimuthDeg !== 'number' || !integer(preview.samples, 1, 4) || !text(preview.basis)
  || !legend || !text(legend.title) || !text(legend.meta) || !integer(legend.stops, 2, 32))) {
  fail('datasets names distinct lenses and its default among them (a cutaway lens needs the cutaway), its preview (sizePx 32 to 1024, elevationDeg, azimuthDeg, samples 1 to 4, basis) and legend (title, meta, stops 2 to 32).');
}
if (!text(recipe.name)) fail('name is what the sphere\'s caption shows.');
if (limb !== undefined && (limb.law !== 'linear' || typeof limb.coefficient !== 'number' || !(limb.coefficient > 0 && limb.coefficient < 1) || !text(limb.basis))) {
  fail('limb is a linear law, I(mu)/I(1) = 1 - u(1 - mu), with its coefficient u in (0, 1) and a basis.');
}
if (recipe.schema !== 'cssearth-map-sphere-source@1' || recipe.id !== id || !text(recipe.source) || !text(recipe.meaning) || !Number.isFinite(recipe.epochJdTt)) {
  fail(`needs schema cssearth-map-sphere-source@1, id ${id}, its source, meaning and epoch.`);
}
if (!map || !text(map.path) || !text(map.origin) || !text(map.column) || map.coordinates !== 'galactic' || !text(map.unit)) fail('map names its FITS path, origin, column, unit and Galactic coordinates.');
if (!colourTable || !text(colourTable.path) || !text(colourTable.origin) || !text(colourTable.basis)) fail('colourTable names its path, origin and basis.');
if (colourTable!.scale !== undefined && (typeof colourTable!.scale !== 'number' || !(colourTable!.scale > 0 && colourTable!.scale <= 1) || !text(colourTable!.scaleBasis))) {
  fail('colourTable.scale darkens every colour by a factor in (0, 1], with its scaleBasis.');
}
if (colourTable!.gamma !== undefined && (typeof colourTable!.gamma !== 'number' || !(colourTable!.gamma > 0) || !text(colourTable!.gammaBasis))) {
  fail('colourTable.gamma raises each colour channel to a positive power, with its gammaBasis.');
}
if (!range || typeof range.min !== 'number' || typeof range.max !== 'number' || !(range.max > range.min) || !text(range.basis)) fail('range is an increasing min and max with a basis.');
if (!radius || typeof radius.redshift !== 'number' || !(radius.redshift > 0) || radius.cosmology !== 'planck18' || !text(radius.basis)) fail('radius is a positive redshift in the planck18 cosmology, with a basis.');
if (!mesh || !integer(mesh.latitudeSegments, 3, 64) || !integer(mesh.longitudeSegments, 3, 128) || !integer(mesh.tilePx, 8, 256) || !integer(mesh.samplesPerTexel, 1, 4) || !text(mesh.basis)) {
  fail('mesh names latitudeSegments (3 to 64), longitudeSegments (3 to 128), tilePx (8 to 256), samplesPerTexel (1 to 4) and a basis.');
}
const tile = mesh!.tilePx as number, samples = mesh!.samplesPerTexel as number;

/** Border texels sampled past each patch's edge. */
const GUTTER = 1;
// The standard sphere at unit radius, as the generated bodies write it (packages/telescope-cli/src/new-object/scaffold.mts):
// caps 3.5% wider than their band's edge, lifted 0.1 of a 248-unit radius. Only the vertices are used; each patch has its
// own tile below instead of the bodies' packed bands.
const unitReference = { url: 'unused', width: 1, height: 1 };
const surfacePatches = createSurfacePatches({ radius: 1, polarRadius: 1, latitudeSegments: mesh!.latitudeSegments as number,
  longitudeSegments: mesh!.longitudeSegments as number, surface: unitReference, surfaceLatitudeHeight: 1, packedBandGutter: 0,
  poles: unitReference, polarTileSize: 1, polarRadiusScale: 1.035, polarOffset: 0.1 / 248, uv: 'cell', color: '#000' });
/** The projective map PolyCSS draws a leaf's image with: the unit square's corners onto the patch's, in vertex order. */
const squareToQuad = ([p0, p1, p2, p3]: Vector3[]) => (s: number, t: number): Vector3 => {
  // Heckbert's square-to-quad homography, solved in the patch's plane (two in-plane axes from its first edges).
  const e1 = p1!.map((value, axis) => value - p0![axis]!) as Vector3, n = cross(e1, p3!.map((value, axis) => value - p0![axis]!) as Vector3);
  const a = normalise(e1), b = normalise(cross(n, a)), local = (p: Vector3) => [dot(p.map((value, axis) => value - p0![axis]!) as Vector3, a), dot(p.map((value, axis) => value - p0![axis]!) as Vector3, b)];
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = [p0!, p1!, p2!, p3!].map(local) as [number, number][];
  const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3, dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2, det = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / det, h = (dx1 * sy - sx * dy1) / det;
  const m = [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h];
  const w = m[6]! * s + m[7]! * t + 1, x = (m[0]! * s + m[1]! * t + m[2]!) / w, y = (m[3]! * s + m[4]! * t + m[5]!) / w;
  return [0, 1, 2].map(axis => p0![axis]! + x * a[axis]! + y * b[axis]!) as Vector3;
};
const cross = (u: Vector3, v: Vector3): Vector3 => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
const dot = (u: Vector3, v: Vector3) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
const normalise = (v: Vector3): Vector3 => { const length = Math.hypot(...v); return v.map(value => value / length) as Vector3; };
const quads = surfacePatches.map(patch => squareToQuad(patch.vertices as Vector3[]));
// A cap spans more of the sky than a band cell, so its tile is as many band tiles wide as it takes for its texels to be
// no coarser than the equator's (the bodies' polar tiles are likewise larger than their band cells).
const edge = (patch: (typeof surfacePatches)[number]) => Math.hypot(...[0, 1, 2].map(axis => patch.vertices[1]![axis]! - patch.vertices[0]![axis]!));
const bandEdge = Math.max(...surfacePatches.filter(patch => !patch.pole).map(edge));
const tiles = surfacePatches.map(patch => patch.pole ? tile * Math.ceil(edge(patch) / bandEdge) : tile);
// The atlas: band tiles in a square-ish grid, the caps in a row beneath.
const cell = tile + 2 * GUTTER, bands = tiles.filter(size => size === tile).length;
const columns = Math.ceil(Math.sqrt(bands)), gridHeight = Math.ceil(bands / columns) * cell;
let capX = 0, bandIndex = 0;
const places = tiles.map((size, k) => {
  if (!surfacePatches[k]!.pole) { const at = bandIndex++; return { x: at % columns * cell, y: Math.floor(at / columns) * cell, side: cell }; }
  const place = { x: capX, y: gridHeight, side: size + 2 * GUTTER }; capX += place.side; return place;
});
const atlasWidth = Math.max(columns * cell, capX), atlasHeight = gridHeight + Math.max(...places.map(place => place.y + place.side - gridHeight));
// Each texel's direction, sampled S x S per texel across the tile and its border, in the patch's own mapping.
const directions = new Float64Array(places.reduce((sum, place) => sum + (place.side * samples) ** 2 * 3, 0));
let written = 0;
quads.forEach((quad, k) => {
  const size = tiles[k]!, offsets = Array.from({ length: places[k]!.side * samples }, (_, n) => (n + 0.5) / (size * samples) - GUTTER / size);
  for (const t of offsets) for (const s of offsets) { directions.set(normalise(quad(s, t)), written); written += 3; }
});

// The map sampled into the atlas, in the toolchain's Python (Astropy, astropy-healpix).
const python = String.raw`import json, sys, numpy as np
from astropy.io import fits
from astropy_healpix import HEALPix
import astropy.units as u
from astropy.cosmology import Planck18
r = json.load(sys.stdin)
hdul = fits.open(r['map'], memmap=True)
hdu = next(h for h in hdul if isinstance(h, fits.BinTableHDU) and r['column'] in h.columns.names)
nside, order, coords = hdu.header['NSIDE'], hdu.header['ORDERING'].strip().lower(), hdu.header.get('COORDSYS', 'G').strip()
if coords not in ('G', 'GALACTIC'): raise ValueError('map is not in Galactic coordinates: %s' % coords)
values = np.asarray(hdu.data[r['column']]).ravel()
hp = HEALPix(nside=nside, order=order)
table = np.loadtxt(r['table'])
if table.shape != (256, 3): raise ValueError('colour table must be 256 RGB rows')
icrs_to_gal = np.array(r['icrsToGalactic'])
dirs = np.frombuffer(open(r['directions'], 'rb').read(), dtype=np.float64)
S = r['samples']
atlas = np.zeros((r['height'], r['width'], 3), dtype=np.uint8)
lo, hi = r['min'], r['max']
start = 0
for place in r['places']:
  C = place['side']
  pts = dirs[start:start + (C * S) ** 2 * 3].reshape(C * S, C * S, 3)
  start += (C * S) ** 2 * 3
  # PolyCSS lays a leaf's image on its vertices in order: top-left on vertex 0, top-right on vertex 1, bottom-right on
  # vertex 2. The directions were taken through that mapping, rows down the tile.
  gal = pts @ icrs_to_gal.T
  lon = np.degrees(np.arctan2(gal[..., 1], gal[..., 0])) % 360
  lat = np.degrees(np.arcsin(np.clip(gal[..., 2], -1, 1)))
  pix = hp.lonlat_to_healpix(lon.ravel() * u.deg, lat.ravel() * u.deg)
  v = values[pix].reshape(C * S, C * S).astype(float)
  v = v.reshape(C, S, C, S).mean(axis=(1, 3))
  idx = np.clip(np.round((v - lo) / (hi - lo) * 255), 0, 255).astype(int)
  rgb = np.round(255 * (table[idx] / 255) ** r['colourGamma'] * r['colourScale']).astype(np.uint8)
  atlas[place['y']:place['y'] + C, place['x']:place['x'] + C] = rgb
open(r['out'], 'wb').write(atlas.tobytes())
# The dataset pictures' rays: one sample each, no averaging (the picture averages its own rays).
for key in ('previewNear', 'previewFar'):
  if key not in r: continue
  pts = np.frombuffer(open(r[key], 'rb').read(), dtype=np.float64).reshape(-1, 3)
  gal = pts @ icrs_to_gal.T
  lon = np.degrees(np.arctan2(gal[:, 1], gal[:, 0])) % 360
  lat = np.degrees(np.arcsin(np.clip(gal[:, 2], -1, 1)))
  v = values[hp.lonlat_to_healpix(lon * u.deg, lat * u.deg)].astype(float)
  idx = np.clip(np.round((v - lo) / (hi - lo) * 255), 0, 255).astype(int)
  open(r[key] + '.rgb', 'wb').write(np.round(255 * (table[idx] / 255) ** r['colourGamma'] * r['colourScale']).astype(np.uint8).tobytes())
d = Planck18.comoving_distance(r['redshift']).to(u.Mpc).value
json.dump({'nside': int(nside), 'ordering': order, 'radiusMpc': float(d), 'min': float(np.nanmin(values)), 'max': float(np.nanmax(values))}, sys.stdout)`;
const ICRS_TO_GALACTIC = [[-0.0548755604162154, -0.8734370902348850, -0.4838350155487132],
  [0.4941094278755837, -0.4448296299600112, 0.7469822444972189], [-0.8676661490190047, -0.1980763734312015, 0.4559837761750669]];
const rawPath = resolve(prepared, `${id}.rgb.tmp`), directionsPath = resolve(prepared, `${id}.directions.tmp`);
await mkdir(prepared, { recursive: true });
await writeFile(directionsPath, new Uint8Array(directions.buffer));
const view = preview ? { sizePx: preview.sizePx as number, elevationDeg: preview.elevationDeg as number, azimuthDeg: preview.azimuthDeg as number,
  samples: preview.samples as number } : null;
const rays = view ? mapSpherePreviewRays(view) : null;
const previewPaths = { previewNear: resolve(prepared, `${id}.near.tmp`), previewFar: resolve(prepared, `${id}.far.tmp`) };
if (rays) { await writeFile(previewPaths.previewNear, new Uint8Array(rays.near.buffer)); await writeFile(previewPaths.previewFar, new Uint8Array(rays.far.buffer)); }
const { astroqueryToolchainSync } = await import('@cssearth/telescope/node');
const toolchain = astroqueryToolchainSync();
const run = spawnSync(toolchain.python, ['-c', python], { env: { ...process.env, ...toolchain.env }, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  input: JSON.stringify({ map: resolve(sourceDirectory, map!.path as string), column: map!.column, table: resolve(sourceDirectory, colourTable!.path as string),
    icrsToGalactic: ICRS_TO_GALACTIC, directions: directionsPath, places, samples, width: atlasWidth, height: atlasHeight, min: range!.min, max: range!.max, out: rawPath, redshift: radius!.redshift, colourScale: colourTable!.scale ?? 1, colourGamma: colourTable!.gamma ?? 1, ...(rays ? previewPaths : {}) }) });
if (run.status !== 0) throw new Error(`Map sampling failed: ${run.stderr.slice(-2000)}`);
const sampled = JSON.parse(run.stdout) as { nside: number; ordering: string; radiusMpc: number; min: number; max: number };
const atlasBytes = await readFile(resolve(rawPath));
await rm(rawPath); await rm(directionsPath);
const webp = await encodeLossyWebp(sharp(atlasBytes, { raw: { width: atlasWidth, height: atlasHeight, channels: 3 } }));
const texturePath = `${id}/${id}.webp`;
await rm(resolve(prepared, id), { recursive: true, force: true });
await mkdir(resolve(prepared, id), { recursive: true });
await writeFile(resolve(prepared, texturePath), webp);

// The limb plate, as the bodies' view-aligned limb frames are drawn (packages/bake/src/photometry/limb.ts): over the
// atlas's mean colour, the overlay that scales it by the law in linear light, colourless (only darkening) past the outline.
const LIMB_PLATE_PX = 512, LIMB_EDGE = 0.98;
let limbOutput: { path: string; edge: number; law: string; coefficient: number; referenceColour: number[]; bytes: number } | undefined;
if (limb) {
  const u = limb.coefficient as number, reference = await meanObservedColour(resolve(prepared, texturePath));
  const plate = Buffer.alloc(LIMB_PLATE_PX * LIMB_PLATE_PX * 4), centre = (LIMB_PLATE_PX - 1) / 2, radiusPx = LIMB_PLATE_PX / 2 * LIMB_EDGE;
  for (let y = 0; y < LIMB_PLATE_PX; y++) for (let x = 0; x < LIMB_PLATE_PX; x++) {
    const r = Math.hypot(x - centre, y - centre) / radiusPx, mu = Math.sqrt(Math.max(0, 1 - Math.min(1, r) ** 2)), factor = 1 - u * (1 - mu);
    const overlay = limbOverlay([factor, factor, factor], reference), [red, green, blue, alpha] = r > 1 ? outsideSilhouette(overlay) : overlay;
    plate.set([red, green, blue, alpha * 255].map(Math.round), (y * LIMB_PLATE_PX + x) * 4);
  }
  const limbPath = `${id}/${id}-limb.webp`, limbBytes = await encodeLossyWebp(sharp(plate, { raw: { width: LIMB_PLATE_PX, height: LIMB_PLATE_PX, channels: 4 } }), { alphaQuality: 100 });
  await writeFile(resolve(prepared, limbPath), limbBytes);
  limbOutput = { path: limbPath, edge: LIMB_EDGE, law: 'linear', coefficient: u, referenceColour: reference, bytes: limbBytes.length };
}

// Each patch: the standard sphere's cell at the map's radius, widened through its own mapping to the tile's border.
const R = sampled.radiusMpc;
const leaves = surfacePatches.map((patch, index) => {
  const quad = quads[index]!, scaled = (s: number, t: number) => quad(s, t).map(value => value * R) as Vector3;
  const { x, y, side } = places[index]!, reach = GUTTER / tiles[index]!;
  const flat: [Vector3, Vector3, Vector3, Vector3] = [scaled(-reach, -reach), scaled(1 + reach, -reach), scaled(1 + reach, 1 + reach), scaled(-reach, 1 + reach)];
  const centre = scaled(0.5, 0.5);
  // The leaf is compiled for one tile-sized image, so its box is the tile and nothing beyond the patch is drawn (no
  // clipping: a leaf shows its whole box). The image's corners follow the vertices' order (see the sampling above).
  const polygon: Polygon = { vertices: flat, uvs: [[0, 0], [1, 0], [1, 1], [0, 1]], texture: texturePath,
    textureImageSource: { url: texturePath, width: side, height: side },
    texturePresentation: { backend: 'image', lighting: 'source', projection: 'projective' }, doubleSided: false };
  const plan = computeTextureAtlasPlanPublic(polygon, index, { tileSize: 50, layerElevation: 50, seamBleed: 0 });
  const geometry = plan && resolvePolyTextureLeafGeometry(plan, { backend: 'image', lighting: 'source', projection: 'projective' });
  if (!geometry) throw new TypeError(`PolyCSS could not prepare patch ${index} of ${id}.`);
  const leaf = compileVolumeLeaf(geometry, side);
  // Then the background is the whole atlas at the leaf's scale, shifted so the leaf's box shows this patch's tile.
  const [sizeX, sizeY] = leaf.style.backgroundSize.split(' ').map(value => Number.parseFloat(value));
  const [offsetX, offsetY] = leaf.style.backgroundPosition.split(' ').map(value => Number.parseFloat(value));
  const scaleX = sizeX! / side, scaleY = sizeY! / side, px = (value: number) => `${Number(value.toFixed(4))}px`;
  // A cutaway opens one hemisphere of the sphere's own frame (ICRS north is +z): its patches are marked, never removed.
  const cut = cutaway !== undefined && (cutaway.hemisphere === 'north' ? centre[2] > 0 : centre[2] < 0);
  return { id: patch.pole ?? `${patch.latitudeIndex}-${patch.longitudeIndex}`, ...(cut ? { cut: true } : {}), centerUnits: centre.map(value => Number(value.toFixed(3))),
    normalUnits: normalise(centre).map(value => Number(value.toFixed(6))),
    ...leaf, style: { ...leaf.style, backgroundSize: `${px(atlasWidth * scaleX)} ${px(atlasHeight * scaleY)}`,
      backgroundPosition: `${px(offsetX! - x * scaleX)} ${px(offsetY! - y * scaleY)}`,
      // Every lane's caps follow one rule (packages/bake/src/scene/polar-cap.ts): the square plate rounded to its disc.
      ...(patch.pole ? { borderRadius: POLAR_CAP_STYLE.split(':')[1]! } : {}) } };
});
// Each dataset's picture and card: the view it shows, drawn as the page draws it (map-sphere-preview.ts), and the colour
// table's legend at evenly spaced stops across the range, in the colours the atlas uses.
let datasetsOutput: object | undefined;
if (lenses && rays && view) {
  const nearColours = await readFile(`${previewPaths.previewNear}.rgb`), farColours = await readFile(`${previewPaths.previewFar}.rgb`);
  for (const path of Object.values(previewPaths)) { await rm(path); await rm(`${path}.rgb`); }
  const pictures = new Map<string, string>();
  for (const lens of lenses) {
    const rgba = composeMapSpherePreview({ view, rays, nearColours, farColours,
      limb: limbOutput ? { coefficient: limbOutput.coefficient, referenceColour: limbOutput.referenceColour as [number, number, number] } : null,
      cut: lens.view === 'cutaway' ? { hemisphere: cutaway!.hemisphere as 'north' | 'south', interiorOpacity: cutaway!.interiorOpacity as number, exteriorOpacity: cutaway!.exteriorOpacity as number } : null });
    const path = `${id}/${id}-${lens.view}.webp`;
    if (!pictures.has(lens.view)) await writeFile(resolve(prepared, path), await encodeLossyWebp(sharp(rgba, { raw: { width: view.sizePx, height: view.sizePx, channels: 4 } }), { alphaQuality: 100 }));
    pictures.set(lens.view, path);
  }
  const table = (await readFile(resolve(sourceDirectory, colourTable!.path as string), 'utf8')).trim().split(/\r?\n/u).map(line => line.trim().split(/\s+/u).map(Number));
  if (table.length !== 256 || table.some(row => row.length !== 3 || row.some(value => !Number.isFinite(value)))) fail('the colour table has 256 RGB rows.');
  const stops = legend!.stops as number, hex = (value: number) => Math.round(255 * (value / 255) ** (colourTable!.gamma as number ?? 1) * ((colourTable!.scale as number | undefined) ?? 1)).toString(16).padStart(2, '0');
  const colors = Array.from({ length: stops }, (_, stop) => `#${table[Math.round(stop / (stops - 1) * 255)]!.map(hex).join('')}`);
  const microkelvin = (kelvin: number) => `${kelvin > 0 ? '+' : kelvin < 0 ? '\u2212' : ''}${Math.round(Math.abs(kelvin) * 1e6)} \u00b5K`;
  const attribution = { label: 'Planck Collaboration (2020); ESA', url: map!.origin as string };
  datasetsOutput = { schema: 'cssearth-map-sphere-datasets@1', objectId: basename(objectDirectory), mesh: `${id}.json`, defaultLens: datasets!.default,
    view: { ...view, basis: preview!.basis },
    controls: lenses.map(lens => ({ id: lens.id, view: lens.view, label: lens.label, detail: lens.detail, title: lens.title, summary: lens.summary,
      description: lens.description, thumbnailUrl: pictures.get(lens.view)!,
      texture: { url: pictures.get(lens.view)!, width: view.sizePx, height: view.sizePx, attribution },
      legend: { kind: 'scale', title: legend!.title, meta: legend!.meta, colors,
        labels: [microkelvin(range!.min as number), microkelvin(0), microkelvin(range!.max as number)] } })) };
}
const extent = Math.ceil(R);
const output = { schema: 'cssearth-image-mesh@1', id, name: recipe.name, source: recipe.source, meaning: recipe.meaning,
  frame: { referenceFrame: 'sun-icrf', epochJdTt: recipe.epochJdTt, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: MPC_M,
    boundsUnits: { min: [-extent, -extent, -extent], max: [extent, extent, extent] } },
  radiusUnits: Number(R.toFixed(3)), texture: { path: texturePath, width: atlasWidth, height: atlasHeight, bytes: webp.length },
  ...(limbOutput ? { limb: limbOutput } : {}),
  ...(cutaway ? { cutaway: { hemisphere: cutaway.hemisphere, interiorOpacity: cutaway.interiorOpacity, exteriorOpacity: cutaway.exteriorOpacity } } : {}),
  sampling: { nside: sampled.nside, ordering: sampled.ordering, mapMin: sampled.min, mapMax: sampled.max, range: range, colourTable: colourTable!.basis, radius: radius, mesh },
  leaves };
await writeFile(resolve(prepared, `${id}.json`), JSON.stringify(output) + '\n');
if (datasetsOutput) await writeFile(resolve(prepared, 'datasets.json'), JSON.stringify(datasetsOutput, null, 2) + '\n');
const { inventoryPreparedAssets } = await import('@cssearth/objects/node');
await inventoryPreparedAssets({ objectId: basename(objectDirectory), objectDirectory });
console.log(`Prepared a ${leaves.length}-patch sphere of radius ${R.toFixed(1)} Mpc with a ${atlasWidth} x ${atlasHeight} atlas (${webp.length} bytes).`);
