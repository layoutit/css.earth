import { existsSync } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { isRecord } from '@cssearth/core';
import { COMPILER_VOLUME_PROVENANCE_SCHEMA } from '@cssearth/objects';
import { prepareOverlayGeometry } from '../../../adapters/renderer/overlay-geometry.ts';

/** A site volume dataset's original photograph as the lab's registered original-image plane (`cssearth-nebula-overlays@1`):
 * the registration the lab workspace that made the dataset already holds, put in the dataset's prepared frame.
 * - A compiled nebula (M42, M8, M45, M1): the compiler result its request names lists each source's original and its sky
 *   bounds in absolute arcsec; the dataset's record gives the local origin of its west/north/away arcsec frame. The
 *   plane is the one the compiler stage draws, on the sky through the volume's origin.
 * - A density reconstruction (LMC, SMC): the dataset's record keeps the registered overlay it was made with; the
 *   Alignment candidate catalogue that holds the same overlay supplies its texture.
 * The texture path is repository-relative. Nothing is derived beyond what those records already fix. */
export async function volumeOriginal(root: string, object: string, dataset: string) {
  if (!/^src\/objects\/[a-z0-9][a-z0-9-]*-volume$/.test(object) || !/^[a-z0-9][a-z0-9-]*$/.test(dataset)) throw new TypeError('Name a site volume and one of its datasets.');
  const json = async (path: string): Promise<unknown> => JSON.parse(await readFile(resolve(root, path), 'utf8'));
  const volume = await json(`${object}/prepared/${dataset}/volume.json`), record = await json(`${object}/prepared/record.json`);
  const frame = isRecord(volume) ? (isRecord(volume.data) ? volume.data.frame : volume.frame) : undefined;
  const provenance = isRecord(record) && isRecord(record.datasets) && isRecord(record.datasets[dataset]) ? record.datasets[dataset].provenance : undefined;
  if (!isRecord(frame) || !isRecord(provenance)) throw new TypeError(`${object} ${dataset}: no prepared frame or provenance record.`);
  const { boundsUnits: _bounds, ...overlayFrame } = frame;
  if (provenance.schema === COMPILER_VOLUME_PROVENANCE_SCHEMA) return compiled(root, object, dataset, provenance, overlayFrame, json);
  if (provenance.schema === 'cssearth-nebula-reconstruction-provenance@1') return reconstructed(root, dataset, provenance, json);
  throw new TypeError(`${object} ${dataset}: its record (${String(provenance.schema)}) holds no registered original photograph.`);
}

/** A compiler source's picture corners (top-left, top-right, bottom-right, bottom-left) in its delivered volume's units,
 * from its sky bounds (absolute west/north arcsec) and the volume's local origin. */
export function compiledCorners(bounds: { min: readonly number[]; max: readonly number[] }, origin: readonly number[]): [number, number, number][] {
  const at = (west: number, north: number): [number, number, number] => [-(west - origin[0]!), north - origin[1]!, 0];
  return [at(bounds.min[0]!, bounds.max[1]!), at(bounds.max[0]!, bounds.max[1]!), at(bounds.max[0]!, bounds.min[1]!), at(bounds.min[0]!, bounds.min[1]!)];
}

async function compiled(root: string, object: string, dataset: string, provenance: Record<string, unknown>, frame: Record<string, unknown>, json: (path: string) => Promise<unknown>) {
  const request = await json(`${object}/source/request.json`), coordinates = provenance.coordinates;
  const origin = isRecord(coordinates) && Array.isArray(coordinates.localOriginArcsec) ? coordinates.localOriginArcsec as number[] : null;
  if (!isRecord(request) || typeof request.recipePath !== 'string' || !origin || origin.length !== 3) throw new TypeError(`${object}: no compiler request or local origin.`);
  // The compile that made this volume shares its local origin; without it, the published compile of the same recipe,
  // whose source bounds are in the same absolute arcsec.
  const sameOrigin = (value: unknown) => isRecord(value) && isRecord(value.scene) && isRecord(value.scene.coordinates) &&
    JSON.stringify(value.scene.coordinates.localOriginArcsec) === JSON.stringify(origin);
  const hasSource = (value: unknown) => isRecord(value) && Array.isArray(value.sources) && value.sources.some(item => isRecord(item) && item.id === dataset &&
    isRecord(item.original) && typeof item.original.path === 'string' && existsSync(resolve(root, item.original.path)));
  let result: Record<string, unknown> | null = null;
  const compiles = resolve(root, '.local/nebula-lab/compiler');
  const made = existsSync(compiles) ? (await Promise.all((await readdir(compiles)).map(async name => {
    const path = resolve(compiles, name, 'result.json');
    return existsSync(path) ? { path, time: (await stat(path)).mtimeMs } : null; }))).filter(item => item !== null).sort((a, b) => b.time - a.time) : [];
  for (const { path } of made) {
    const value: unknown = await readFile(path, 'utf8').then(text => JSON.parse(text), () => null);
    if (sameOrigin(value) && hasSource(value)) { result = value as Record<string, unknown>; break; }
  }
  const published = `${object}/.local/compiler-published.json`;
  for (const pin of !result && existsSync(resolve(root, published)) ? [await json(published)] : []) {
    if (isRecord(pin) && pin.recipePath === request.recipePath && isRecord(pin.result) && typeof pin.result.path === 'string') {
      const value = await json(pin.result.path);
      if (hasSource(value)) { result = value as Record<string, unknown>; break; }
    }
  }
  if (!result) throw new Error(`${object}: no compile of ${request.recipePath} with source ${dataset} is in this checkout's lab cache. Compile it in the lab workspace.`);
  const source = Array.isArray(result.sources) ? result.sources.find(item => isRecord(item) && item.id === dataset) : undefined;
  if (!isRecord(source) || !isRecord(source.original) || typeof source.original.path !== 'string' || !isRecord(source.boundsArcsec)) throw new TypeError(`${object}: the compiler result has no source ${dataset}.`);
  const { min, max } = source.boundsArcsec as { min: [number, number]; max: [number, number] }, width = Number(source.width), height = Number(source.height);
  if (frame.referenceFrame !== 'sun-icrf') throw new TypeError(`${object}: expected a delivered sun-icrf frame.`);
  // The delivered volume reflects the compiler's west axis into east (`reflectNebulaPoint` in the nebula bake): local x is
  // origin west minus west, y is north minus origin north. The picture's top-left is its east and north edges.
  const geometry = prepareOverlayGeometry(compiledCorners({ min, max }, origin), width, height);
  return { texture: source.original.path, catalogue: { schema: 'cssearth-nebula-overlays@1', frame, overlays: [{ id: dataset, label: 'Original image', texturePath: 'original',
    widthPx: width, heightPx: height, pivotCssPx: [0, 0, 0], sourcePageUrl: String(source.page), credit: String(source.credit),
    registrationNote: 'The compiler’s registered source image, on the sky through the volume origin, as the compiler stage draws it.',
    style: { width: `${width}px`, height: `${height}px`, transform: `matrix3d(${geometry.matrix})`, backgroundSize: `${width}px ${height}px`, backgroundPosition: '0px 0px' } }] } };
}

async function reconstructed(root: string, dataset: string, provenance: Record<string, unknown>, json: (path: string) => Promise<unknown>) {
  const request = provenance.request, overlay = isRecord(request) ? request.overlay : undefined;
  if (!isRecord(request) || !isRecord(overlay) || typeof overlay.transform !== 'string') throw new TypeError(`${dataset}: its record keeps no registered overlay.`);
  const placement = overlay.placement;
  if (isRecord(placement) && (placement.x !== 0 || placement.y !== 0 || placement.z !== 0 || placement.rotationX !== 0 || placement.rotationY !== 0 || placement.rotationZ !== 0 || placement.scale !== 1))
    throw new TypeError(`${dataset}: its overlay carries a placement; the original plane needs the registration in its geometry.`);
  const subjects = await json('labs/nebula/packages/lab/src/state/processing-subjects.json');
  const catalogues = [...new Set((Array.isArray(subjects) ? subjects : []).flatMap(item => isRecord(item) && isRecord(item.density) && typeof item.density.overlays === 'string' ? [item.density.overlays] : []))];
  for (const path of catalogues) {
    const catalogue = await json(path).catch(() => null);
    if (!isRecord(catalogue) || !Array.isArray(catalogue.overlays)) continue;
    const item = catalogue.overlays.find(value => isRecord(value) && isRecord(value.style) && value.style.transform === overlay.transform);
    if (!isRecord(item) || typeof item.texturePath !== 'string') continue;
    const texture = `${dirname(path)}/${item.texturePath}`;
    if (!existsSync(resolve(root, texture))) throw new Error(`${texture} is not prepared in this checkout; the lab prepares candidate reference images at startup.`);
    const { initialPlacement: _placement, variants: _variants, ...plain } = item;
    return { texture, catalogue: { schema: catalogue.schema, frame: catalogue.frame, ...(catalogue.referenceDistanceUnits === undefined ? {} : { referenceDistanceUnits: catalogue.referenceDistanceUnits }), overlays: [plain] } };
  }
  throw new Error(`${dataset}: no Alignment catalogue holds the overlay its record was made with.`);
}
