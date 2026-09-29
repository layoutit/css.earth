/**
 * Prepare an all-sky HEALPix map as a sphere of image patches around the Sun, seen from outside: the cosmic microwave
 * background at the distance its light left from. `source/<id>/sphere.json` names the map (its FITS file, column and
 * coordinate system), the colour table and the value range it is drawn over, and the sphere's radius as a redshift
 * turned into a comoving distance in the Planck 2018 cosmology (Astropy's Planck18).
 *
 * The sphere is a cube-sphere: each face of a cube around the Sun is cut into `patchesPerEdge`² patches, each patch's
 * corners pushed out to the sphere and flattened onto their mean plane, so every patch is one planar PolyCSS leaf. Each
 * patch's tile of the atlas samples the map at its texels' directions (ICRS, turned into the map's Galactic
 * coordinates), `samplesPerTexel`² samples averaged. The atlas goes through the lossy lane. Writes `prepared/<id>.json`
 * (`cssearth-image-mesh@1`, read by packages/renderer/src/universe/image-mesh.ts) and `prepared/<id>/<id>.webp`.
 *
 * Usage: node packages/bake/cli/prepare-map-sphere.mts <object-directory> <id>
 */
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import sharp from 'sharp';
import { computeTextureAtlasPlanPublic, resolvePolyTextureLeafGeometry, type Polygon } from '@layoutit/polycss';
import { compileVolumeLeaf } from '@cssearth/bake/volume-leaves';
import { encodeLossyWebp } from '@cssearth/bake/raster';

type Vector3 = [number, number, number];
const MPC_M = 3.0856775814913673e22;
const [objectArgument, id] = process.argv.slice(2);
if (!objectArgument || !id || !/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Usage: prepare-map-sphere.mts <object-directory> <id>');
const objectDirectory = resolve(objectArgument), sourceDirectory = resolve(objectDirectory, 'source', id), prepared = resolve(objectDirectory, 'prepared');
const recipePath = resolve(sourceDirectory, 'sphere.json');
const recipe = JSON.parse(await readFile(recipePath, 'utf8')) as {
  schema?: unknown; id?: unknown; source?: unknown; meaning?: unknown;
  map?: { path?: unknown; origin?: unknown; column?: unknown; coordinates?: unknown; unit?: unknown };
  colourTable?: { path?: unknown; origin?: unknown; basis?: unknown };
  range?: { min?: unknown; max?: unknown; basis?: unknown };
  radius?: { redshift?: unknown; cosmology?: unknown; basis?: unknown };
  mesh?: { patchesPerEdge?: unknown; tilePx?: unknown; samplesPerTexel?: unknown; basis?: unknown };
  epochJdTt?: unknown };
const fail = (message: string): never => { throw new TypeError(`${recipePath}: ${message}`); };
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const integer = (value: unknown, low: number, high: number): value is number => Number.isInteger(value) && (value as number) >= low && (value as number) <= high;
const { map, colourTable, range, radius, mesh } = recipe;
if (recipe.schema !== 'cssearth-map-sphere-source@1' || recipe.id !== id || !text(recipe.source) || !text(recipe.meaning) || !Number.isFinite(recipe.epochJdTt)) {
  fail(`needs schema cssearth-map-sphere-source@1, id ${id}, its source, meaning and epoch.`);
}
if (!map || !text(map.path) || !text(map.origin) || !text(map.column) || map.coordinates !== 'galactic' || !text(map.unit)) fail('map names its FITS path, origin, column, unit and Galactic coordinates.');
if (!colourTable || !text(colourTable.path) || !text(colourTable.origin) || !text(colourTable.basis)) fail('colourTable names its path, origin and basis.');
if (!range || typeof range.min !== 'number' || typeof range.max !== 'number' || !(range.max > range.min) || !text(range.basis)) fail('range is an increasing min and max with a basis.');
if (!radius || typeof radius.redshift !== 'number' || !(radius.redshift > 0) || radius.cosmology !== 'planck18' || !text(radius.basis)) fail('radius is a positive redshift in the planck18 cosmology, with a basis.');
if (!mesh || !integer(mesh.patchesPerEdge, 1, 16) || !integer(mesh.tilePx, 8, 256) || !integer(mesh.samplesPerTexel, 1, 4) || !text(mesh.basis)) {
  fail('mesh names patchesPerEdge (1 to 16), tilePx (8 to 256), samplesPerTexel (1 to 4) and a basis.');
}
const patches = mesh!.patchesPerEdge as number, tile = mesh!.tilePx as number, samples = mesh!.samplesPerTexel as number;

// Cube faces: the outward axis and the two in-face axes, so the corner order is counter-clockwise seen from outside.
const FACES: [Vector3, Vector3, Vector3][] = [
  [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
  [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
  [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]];
const direction = (face: number, u: number, v: number): Vector3 => {
  const [n, a, b] = FACES[face]!;
  const point = [0, 1, 2].map(axis => n[axis]! + u * a[axis]! + v * b[axis]!) as Vector3, length = Math.hypot(...point);
  return point.map(value => value / length) as Vector3;
};
const columns = Math.ceil(Math.sqrt(6 * patches * patches)), rows = Math.ceil(6 * patches * patches / columns);

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
faces = [np.array(f, dtype=float) for f in r['faces']]
P, T, S = r['patches'], r['tile'], r['samples']
cols, rows = r['columns'], r['rows']
atlas = np.zeros((rows * T, cols * T, 3), dtype=np.uint8)
lo, hi = r['min'], r['max']
k = 0
for face in range(6):
  n, a, b = faces[face]
  for i in range(P):
    for j in range(P):
      # texel centres of this patch, with S x S subsamples each
      steps = (np.arange(T * S) + 0.5) / (T * S)
      uu = -1 + 2 * (i + steps) / P
      vv = -1 + 2 * (j + steps) / P
      U, V = np.meshgrid(uu, vv)  # V rows (down the tile), U columns
      pts = n[None, None, :] + U[..., None] * a[None, None, :] + V[..., None] * b[None, None, :]
      pts /= np.linalg.norm(pts, axis=-1, keepdims=True)
      gal = pts @ icrs_to_gal.T
      lon = np.degrees(np.arctan2(gal[..., 1], gal[..., 0])) % 360
      lat = np.degrees(np.arcsin(np.clip(gal[..., 2], -1, 1)))
      pix = hp.lonlat_to_healpix(lon.ravel() * u.deg, lat.ravel() * u.deg)
      v = values[pix].reshape(T * S, T * S).astype(float)
      v = v.reshape(T, S, T, S).mean(axis=(1, 3))
      idx = np.clip(np.round((v - lo) / (hi - lo) * 255), 0, 255).astype(int)
      rgb = table[idx].astype(np.uint8)
      row, col = divmod(k, cols)
      atlas[row * T:(row + 1) * T, col * T:(col + 1) * T] = rgb[::-1]  # image rows run down, v runs up
      k += 1
open(r['out'], 'wb').write(atlas.tobytes())
d = Planck18.comoving_distance(r['redshift']).to(u.Mpc).value
json.dump({'nside': int(nside), 'ordering': order, 'radiusMpc': float(d), 'min': float(np.nanmin(values)), 'max': float(np.nanmax(values))}, sys.stdout)`;
const ICRS_TO_GALACTIC = [[-0.0548755604162154, -0.8734370902348850, -0.4838350155487132],
  [0.4941094278755837, -0.4448296299600112, 0.7469822444972189], [-0.8676661490190047, -0.1980763734312015, 0.4559837761750669]];
const rawPath = resolve(prepared, `${id}.rgb.tmp`);
await mkdir(prepared, { recursive: true });
const { astroqueryToolchainSync } = await import('@cssearth/telescope/node');
const toolchain = astroqueryToolchainSync();
const run = spawnSync(toolchain.python, ['-c', python], { env: { ...process.env, ...toolchain.env }, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  input: JSON.stringify({ map: resolve(sourceDirectory, map!.path as string), column: map!.column, table: resolve(sourceDirectory, colourTable!.path as string),
    icrsToGalactic: ICRS_TO_GALACTIC, faces: FACES, patches, tile, samples, columns, rows, min: range!.min, max: range!.max, out: rawPath, redshift: radius!.redshift }) });
if (run.status !== 0) throw new Error(`Map sampling failed: ${run.stderr.slice(-2000)}`);
const sampled = JSON.parse(run.stdout) as { nside: number; ordering: string; radiusMpc: number; min: number; max: number };
const atlasBytes = await readFile(resolve(rawPath));
await rm(rawPath);
const webp = await encodeLossyWebp(sharp(atlasBytes, { raw: { width: columns * tile, height: rows * tile, channels: 3 } }));
const texturePath = `${id}/${id}.webp`;
await rm(resolve(prepared, id), { recursive: true, force: true });
await mkdir(resolve(prepared, id), { recursive: true });
await writeFile(resolve(prepared, texturePath), webp);

// Each patch: its four corners on the sphere, flattened onto their mean plane, and its tile of the atlas.
const R = sampled.radiusMpc, atlasWidth = columns * tile, atlasHeight = rows * tile;
const leaves = [];
let index = 0;
for (let face = 0; face < 6; face++) for (let i = 0; i < patches; i++) for (let j = 0; j < patches; j++) {
  const at = (s: number, t: number) => direction(face, -1 + 2 * (i + s) / patches, -1 + 2 * (j + t) / patches).map(value => value * R) as Vector3;
  const corners = [at(0, 0), at(1, 0), at(1, 1), at(0, 1)];
  const centre = [0, 1, 2].map(axis => corners.reduce((sum, corner) => sum + corner[axis]!, 0) / 4) as Vector3;
  const normalLength = Math.hypot(...centre), normal = centre.map(value => value / normalLength) as Vector3;
  const flat = corners.map(corner => { const offset = corner.reduce((sum, value, axis) => sum + (value - centre[axis]!) * normal[axis]!, 0);
    return corner.map((value, axis) => value - offset * normal[axis]!) as Vector3; }) as [Vector3, Vector3, Vector3, Vector3];
  const row = Math.floor(index / columns), column = index % columns;
  const u0 = column * tile / atlasWidth, u1 = (column + 1) * tile / atlasWidth, v0 = row * tile / atlasHeight, v1 = (row + 1) * tile / atlasHeight;
  // The tile's rows run down from v's top (t = 1) to its bottom (t = 0).
  const polygon: Polygon = { vertices: flat, uvs: [[u0, v1], [u1, v1], [u1, v0], [u0, v0]], texture: texturePath,
    textureImageSource: { url: texturePath, width: atlasWidth, height: atlasHeight },
    texturePresentation: { backend: 'image', lighting: 'source', projection: 'projective' }, doubleSided: false };
  const plan = computeTextureAtlasPlanPublic(polygon, index, { tileSize: 50, layerElevation: 50, seamBleed: 0 });
  const geometry = plan && resolvePolyTextureLeafGeometry(plan, { backend: 'image', lighting: 'source', projection: 'projective' });
  if (!geometry) throw new TypeError(`PolyCSS could not prepare patch ${index} of ${id}.`);
  leaves.push({ id: `${face}-${i}-${j}`, centerUnits: centre.map(value => Number(value.toFixed(3))), normalUnits: normal.map(value => Number(value.toFixed(6))),
    ...compileVolumeLeaf(geometry, atlasWidth) });
  index++;
}
const reach = Math.ceil(R);
const output = { schema: 'cssearth-image-mesh@1', id, source: recipe.source, meaning: recipe.meaning,
  frame: { referenceFrame: 'sun-icrf', epochJdTt: recipe.epochJdTt, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: MPC_M,
    boundsUnits: { min: [-reach, -reach, -reach], max: [reach, reach, reach] } },
  radiusUnits: Number(R.toFixed(3)), texture: { path: texturePath, width: atlasWidth, height: atlasHeight, bytes: webp.length },
  sampling: { nside: sampled.nside, ordering: sampled.ordering, mapMin: sampled.min, mapMax: sampled.max, range: range, colourTable: colourTable!.basis, radius: radius, mesh },
  leaves };
await writeFile(resolve(prepared, `${id}.json`), JSON.stringify(output) + '\n');
const { inventoryPreparedAssets } = await import('@cssearth/objects/node');
await inventoryPreparedAssets({ objectId: basename(objectDirectory), objectDirectory });
console.log(`Prepared a ${leaves.length}-patch sphere of radius ${R.toFixed(1)} Mpc with a ${atlasWidth} x ${atlasHeight} atlas (${webp.length} bytes).`);
