/**
 * One owner for placing a pinned published star catalogue inside a saved simulation-guided finite
 * emission model, shared by every body that has such a model (SMC, LMC).
 *
 * The method is the same for all of them: the model's own emission, times the density its envelope
 * pins, times the (1+z/D)^2 solid-angle factor, inverted at a fixed per-star SHA-256 quantile with
 * explicit zero-support guards. Each body keeps its own catalogue columns, footprint facts and
 * provenance prose; nothing about a single body belongs here.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { sha256 } from '@cssearth/core/node';
import { basename, dirname, resolve } from 'node:path';
import { sampleJointDepth } from '@cssearth/nebula-reconstruction/stars/joint-depth';
import { prepareStarPhotometry } from '@cssearth/volume-core/materials/star-photometry';
import { rayToOverlayPlane } from '@cssearth/volume-core/coordinates/overlay-wcs';
import type { PreparedLmcStar, PreparedLmcStars } from '@cssearth/volume-core/contracts/prepared-catalogue-stars';
import { parsePreparedLmcStars } from '@cssearth/volume-core/contracts/prepared-catalogue-stars';
import { catalogueColor } from '../../../adapters/sources/stellar-color.ts';
import { parseLabModelJson } from '../../../resources/model-paths.ts';
import { implementationPins } from '../../services/implementation.ts';
import { finiteModelDirectory, type FiniteModelStarContext } from './finite-model-star-context.ts';

/** Published Johnson V limit of every finite-model star layer. */
export const MAGNITUDE_LIMIT = 16;
/** Model-owned external index beside the lens bundle; discovery reads exactly this path. */
export const finiteModelStarsIndex = (modelResultId: string) => `.local/nebula-lab/finite-stars-${modelResultId}.json`;
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The executable owners of the shared placement, pinned into every layer's provenance. */
export const FINITE_STAR_PLACEMENT_OWNERS = [
  'labs/nebula/packages/lab/src/server/workflows/stars/finite-model-star-layer.ts',
  'labs/nebula/packages/lab/src/server/workflows/stars/finite-model-star-context.ts',
] as const;

/** The published columns the shared placement needs from one catalogue row. Blank optional fields are NaN. */
export interface CatalogueStarRow {
  name: string; raDeg: number; decDeg: number; bmag: number; vmag: number; spectralType: string;
}
export interface FiniteStarSelection {
  stars: PreparedLmcStar[]; inputRows: number; finiteV: number; brightV: number; inFootprint: number;
  unsupported: { id: string; reason: string }[];
}

export const FINITE_STAR_METHOD = 'Conditional depth PDF proportional to maxRGB(finite components + simulation envelope, sampled as the model bake samples physical space, zero outside the baked box) times decoded simulation density times (1+z/D)^2. 1536 intervals span the baked depth range; a fixed SHA-256 source-ID quantile inverts its piecewise-linear CDF. Chosen points must have strictly positive emission and density, with an explicit zero-support gap guard.';
export const FINITE_STAR_COORDINATES = 'Measured ray -> model tangent plane (rayToOverlayPlane in the model frame); (x,y,z)=(x0*(1+z/D),y0*(1+z/D),z) kpc in the model frame.';
export const FINITE_STAR_SUPPORT = 'cloudSignal is the model cutoff signal (aligned-image.png luminance, global maximum normalization) at the placed point; membership is the single all-light part. Stars below 8-bit signal quantization keep zero and stay visible at cutoff 0.';
export const FINITE_STAR_COLOR = 'Published B-V mapped through the existing catalogue display-color approximation; white when B absent. No dereddening. Display size and opacity follow the shared magnitude response, not measured diameters.';

/**
 * Measured ray -> model tangent; finite V <= MAGNITUDE_LIMIT inside the fit footprint; depth from the
 * joint emission x density x (1+z/D)^2 CDF. Every omission is recorded, never relocated or invented.
 */
export function placeCatalogueStarsInFiniteModel(table: string, context: FiniteModelStarContext,
  options: { starIdPrefix: string; readRow: (line: string) => CatalogueStarRow }): FiniteStarSelection {
  if (context.partIds.length !== 1) throw new TypeError('Finite model stars require the single all-light emission part.');
  if (!/^[A-Za-z0-9]{1,32}:$/.test(options.starIdPrefix)) throw new TypeError('Invalid catalogue star id prefix.');
  const lines = table.trimEnd().split('\n'), stars: PreparedLmcStar[] = [], unsupported: FiniteStarSelection['unsupported'] = [];
  const ids = new Set<string>();
  let finiteV = 0, brightV = 0, inFootprint = 0;
  const source = { mapping: context.mapping, supportBounds: context.supportBounds, densityAt: context.densityAt, sampleEmission: context.sampleEmission };
  for (const line of lines) {
    const row = options.readRow(line);
    if (![row.raDeg, row.decDeg, row.vmag].every(Number.isFinite)) continue;
    finiteV++;
    if (row.vmag > MAGNITUDE_LIMIT) continue;
    brightV++;
    const id = `${options.starIdPrefix}${row.name}`;
    if (!row.name || ids.has(id)) throw new TypeError(`Catalogue star designation is missing or repeated: ${row.name}`);
    ids.add(id);
    const a = row.raDeg * Math.PI / 180, d = row.decDeg * Math.PI / 180;
    const tangent = rayToOverlayPlane([Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)], context.frame);
    if (!context.inFootprint(tangent[0], tangent[1])) continue;
    inFootprint++;
    let depth: number;
    try { depth = sampleJointDepth(source, tangent[0], tangent[1], id); } catch (error) {
      // Only a measured ray with no positive joint support is omitted; every omission is recorded, never relocated.
      const reason = error instanceof Error ? error.message : String(error);
      if (!/No joint stellar and cloud emission/.test(reason)) throw error;
      unsupported.push({ id, reason }); continue;
    }
    const positionUnits = context.mapping.pointAtDepth(tangent[0], tangent[1], depth);
    const emission: [number, number, number] = [0, 0, 0];
    context.sampleEmission(tangent[0], tangent[1], depth, emission);
    if (!(Math.max(...emission) > 0 && context.densityAt(...positionUnits) > 0))
      throw new Error(`Placed star lacks positive joint support: ${id}`);
    const cloudSignal = context.sampleSignal(...positionUnits);
    if (!Number.isFinite(cloudSignal) || cloudSignal < 0 || cloudSignal > 1) throw new TypeError(`Invalid cutoff signal: ${id}`);
    const colorIndexBv = Number.isFinite(row.bmag) ? row.bmag - row.vmag : null;
    const colorCss = '#' + catalogueColor(NaN, colorIndexBv ?? NaN).map(v => v.toString(16).padStart(2, '0')).join('');
    stars.push({ id, raDeg: row.raDeg, decDeg: row.decDeg, magnitude: row.vmag, colorIndexBv, spectralType: row.spectralType,
      positionUnits, cloudSignal, cloudPartIds: [...context.partIds], colorCss, ...prepareStarPhotometry(row.vmag, colorCss) });
  }
  stars.sort((a, b) => a.magnitude - b.magnitude || a.id.localeCompare(b.id));
  return { stars, inputRows: lines.length, finiteV, brightV, inFootprint, unsupported };
}

/**
 * One prepared layer per lens recipe of one body: finite-lenses.json -> <base>.json,
 * finite-lenses-<name>.json -> <base>-<name>.json. The base name lets a body whose historical
 * layer already owns prepared/stars.json keep both without either overwriting the other.
 */
export function preparedStarsLayerPath(starDirectory: string, finiteLensRecipe: string, layerBaseName = 'stars') {
  const name = basename(finiteLensRecipe), match = /^finite-lenses(?:-([a-z0-9-]+))?\.json$/.exec(name);
  if (!match) throw new TypeError(`Lens recipe name does not identify a star layer: ${name}`);
  if (!/^[a-z0-9-]+$/.test(layerBaseName)) throw new TypeError(`Invalid prepared star layer name: ${layerBaseName}`);
  return `${starDirectory}/prepared/${layerBaseName}${match[1] ? `-${match[1]}` : ''}.json`;
}

/** The checked-in lens recipe names the current model; a re-fit updates it and the star command follows. */
export async function readFiniteLensRecipe(root: string, path: string) {
  const bytes = await readFile(resolve(root, path)), recipe: unknown = parseLabModelJson(bytes.toString());
  if (!record(recipe) || recipe.schema !== 'cssearth-finite-lens-recipe@1' || typeof recipe.modelResultId !== 'string' ||
      !/^[a-f0-9]{64}$/.test(recipe.modelResultId)) throw new TypeError('Invalid finite lens recipe.');
  return { modelResultId: recipe.modelResultId, sha256: sha256(bytes) };
}

/** The lab subject that owns the model; discovery refuses a star index that names any other subject. */
export async function finiteModelSubjectId(root: string, modelResultId: string) {
  const result: unknown = parseLabModelJson(await readFile(resolve(root, finiteModelDirectory(modelResultId), 'result.json'), 'utf8'));
  const subjectId = record(result) && record(result.subject) ? result.subject.sourceSubjectId : undefined;
  if (typeof subjectId !== 'string' || !/^[a-z0-9-]+$/.test(subjectId)) throw new TypeError('Finite model has no owning subject.');
  return subjectId;
}

/** Byte pins of a body's checked-in catalogue tables; a changed file stops the preparation. */
export async function readPinnedCatalogueFiles(root: string, sourceDirectory: string,
  files: readonly { path: string; sha256: string; url: string }[]) {
  return Promise.all(files.map(async entry => {
    const bytes = await readFile(resolve(root, sourceDirectory, entry.path));
    if (sha256(bytes) !== entry.sha256) throw new Error(`Catalogue pin changed: ${entry.path}`);
    return { ...entry, bytes: bytes.length };
  }));
}

/** The shared finite-model block of a layer's provenance: the model's own pins plus the placement method. */
export async function finiteModelStarProvenance(root: string, options: {
  context: FiniteModelStarContext; subjectId: string; lensRecipe: { path: string; sha256: string }; command: string;
}) {
  const implementation = Object.fromEntries((await implementationPins(root,
    [options.command, ...FINITE_STAR_PLACEMENT_OWNERS])).map(pin => [pin.path, pin.sha256]));
  return { ...options.context.provenance, subjectId: options.subjectId, lensRecipe: options.lensRecipe, implementation,
    method: FINITE_STAR_METHOD, coordinates: FINITE_STAR_COORDINATES, support: FINITE_STAR_SUPPORT };
}

/**
 * Validate the layer against the model frame, write it, and write the model-owned star index beside the
 * lens bundle. Every lens of the model then references this one image-independent prepared file.
 */
export async function writeFiniteModelStarLayer(root: string, options: {
  context: FiniteModelStarContext; subjectId: string; output: string; payload: PreparedLmcStars;
}) {
  parsePreparedLmcStars(options.payload, options.context.frame);
  const bytes = JSON.stringify(options.payload, null, 2) + '\n';
  await mkdir(dirname(resolve(root, options.output)), { recursive: true });
  await writeFile(resolve(root, options.output), bytes);
  const index = { schema: 'cssearth-finite-model-stars@1', modelResultId: options.context.modelResultId,
    subjectId: options.subjectId, stars: { path: options.output, sha256: sha256(bytes) } };
  const indexPath = finiteModelStarsIndex(options.context.modelResultId);
  await writeFile(resolve(root, indexPath), JSON.stringify(index, null, 2) + '\n');
  return { index: indexPath, sha256: index.stars.sha256 };
}
