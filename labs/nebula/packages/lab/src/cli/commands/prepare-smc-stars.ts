/** Offline preparation of the published Bonanos et al. (2010) massive SMC star sample inside the current finite SMC model. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, resolve } from 'node:path';
import { sampleJointDepth } from '@cssearth/nebula-reconstruction/stars/joint-depth';
import { prepareStarPhotometry, STAR_PHOTOMETRY } from '@cssearth/volume-core/materials/star-photometry';
import { rayToOverlayPlane } from '@cssearth/volume-core/coordinates/overlay-wcs';
import { parsePreparedLmcStars, type PreparedLmcStar, type PreparedLmcStars } from '@cssearth/volume-core/contracts/prepared-catalogue-stars';
import { catalogueColor } from '../../adapters/sources/stellar-color.ts';
import { parseLabModelJson } from '../../resources/model-paths.ts';
import { implementationPins } from '../../server/services/implementation.ts';
import { loadFiniteModelStarContext, finiteModelDirectory, type FiniteModelStarContext } from '../../server/workflows/stars/finite-model-star-context.ts';

export const smcStarDirectory = 'labs/nebula/models/smc/stars';
export const STAR_ID_PREFIX = 'Bonanos2010:';
export const MAGNITUDE_LIMIT = 16;
export const finiteModelStarsIndex = (modelResultId: string) => `.local/nebula-lab/finite-stars-${modelResultId}.json`;
const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** CDS J/AJ/140/416 table3.dat bytes (1-based, inclusive) from the pinned ReadMe. Blank optional fields are NaN. */
export function readBonanos2010Row(line: string) {
  const field = (first: number, last: number) => line.slice(first - 1, last).trim();
  const number = (first: number, last: number) => { const text = field(first, last); return text ? Number(text) : NaN; };
  return { name: field(1, 17), raDeg: number(84, 92), decDeg: number(94, 102), bmag: number(117, 122), vmag: number(130, 135),
    spectralType: field(315, 348) };
}

export interface SmcStarSelection {
  stars: PreparedLmcStar[]; inputRows: number; finiteV: number; brightV: number; inFootprint: number;
  unsupported: { id: string; reason: string }[];
}
/** Measured ray -> model tangent; finite V <= 16 inside the fit footprint; depth from the joint emission x density x (1+z/D)^2 CDF. */
export function prepareSmcCatalogue(table: string, context: FiniteModelStarContext): SmcStarSelection {
  if (context.partIds.length !== 1) throw new TypeError('Finite model stars require the single all-light emission part.');
  const lines = table.trimEnd().split('\n'), stars: PreparedLmcStar[] = [], unsupported: SmcStarSelection['unsupported'] = [];
  const ids = new Set<string>();
  let finiteV = 0, brightV = 0, inFootprint = 0;
  const source = { mapping: context.mapping, supportBounds: context.supportBounds, densityAt: context.densityAt, sampleEmission: context.sampleEmission };
  for (const line of lines) {
    const row = readBonanos2010Row(line);
    if (![row.raDeg, row.decDeg, row.vmag].every(Number.isFinite)) continue;
    finiteV++;
    if (row.vmag > MAGNITUDE_LIMIT) continue;
    brightV++;
    const id = `${STAR_ID_PREFIX}${row.name}`;
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

export async function readSmcStarManifest(root: string) {
  const manifest: unknown = parseLabModelJson(await readFile(resolve(root, smcStarDirectory, 'source/catalogue.json'), 'utf8'));
  if (!record(manifest) || manifest.schema !== 'cssearth-pinned-catalogue@1' || manifest.catalogue !== 'J/AJ/140/416' ||
      !Array.isArray(manifest.files) || !record(manifest.depthModel) || !record(manifest.depthModel.finiteLensRecipe) ||
      typeof manifest.depthModel.finiteLensRecipe.path !== 'string') throw new TypeError('Invalid SMC star catalogue manifest.');
  const files = manifest.files.map(entry => {
    if (!record(entry) || typeof entry.path !== 'string' || !/^[A-Za-z0-9._-]+$/.test(entry.path) || typeof entry.sha256 !== 'string' ||
        typeof entry.url !== 'string' || !entry.url.startsWith('https://cdsarc.cds.unistra.fr/ftp/J/AJ/140/416/')) throw new TypeError('Invalid catalogue file pin.');
    return { path: entry.path, sha256: entry.sha256, url: entry.url };
  });
  return { files, finiteLensRecipe: manifest.depthModel.finiteLensRecipe.path };
}

/** One prepared layer per lens recipe: finite-lenses.json -> stars.json, finite-lenses-<name>.json -> stars-<name>.json. */
export function preparedStarsPath(finiteLensRecipe: string) {
  const name = basename(finiteLensRecipe), match = /^finite-lenses(?:-([a-z0-9-]+))?\.json$/.exec(name);
  if (!match) throw new TypeError(`Lens recipe name does not identify a star layer: ${name}`);
  return `${smcStarDirectory}/prepared/stars${match[1] ? `-${match[1]}` : ''}.json`;
}
export async function prepareSmcStars(root = process.cwd(), recipePath?: string) {
  const manifest = await readSmcStarManifest(root);
  const files = manifest.files;
  // The recipe names the model; the manifest holds the default, and a second recipe is passed explicitly. No result id is hard-coded.
  const finiteLensRecipe = recipePath ?? manifest.finiteLensRecipe;
  if (finiteLensRecipe !== manifest.finiteLensRecipe && (!/^labs\/nebula\/models\/smc\/constrained\/[A-Za-z0-9._-]+\.json$/.test(finiteLensRecipe)))
    throw new TypeError('A star layer recipe must be a checked-in SMC lens recipe.');
  const sources = await Promise.all(files.map(async entry => {
    const bytes = await readFile(resolve(root, smcStarDirectory, 'source', entry.path));
    if (sha256(bytes) !== entry.sha256) throw new Error(`Catalogue pin changed: ${entry.path}`);
    return { ...entry, bytes: bytes.length };
  }));
  // The checked-in lens recipe names the current model; a re-fit updates it, and this command follows.
  const recipeBytes = await readFile(resolve(root, finiteLensRecipe)), recipe: unknown = parseLabModelJson(recipeBytes.toString());
  if (!record(recipe) || recipe.schema !== 'cssearth-finite-lens-recipe@1' || typeof recipe.modelResultId !== 'string')
    throw new TypeError('Invalid finite lens recipe.');
  const context = await loadFiniteModelStarContext(root, recipe.modelResultId);
  const result: unknown = parseLabModelJson(await readFile(resolve(root, finiteModelDirectory(context.modelResultId), 'result.json'), 'utf8'));
  const subjectId = record(result) && record(result.subject) ? result.subject.sourceSubjectId : undefined;
  if (typeof subjectId !== 'string' || !/^[a-z0-9-]+$/.test(subjectId)) throw new TypeError('Finite model has no owning subject.');
  const table = await readFile(resolve(root, smcStarDirectory, 'source/table3.dat'), 'utf8');
  const selection = prepareSmcCatalogue(table, context);
  if (selection.inputRows !== 3654 || selection.stars.length < 100) throw new Error(`Unexpected catalogue sample: ${JSON.stringify({ ...selection, stars: selection.stars.length })}`);
  const implementation = Object.fromEntries((await implementationPins(root, ['labs/nebula/packages/lab/src/cli/commands/prepare-smc-stars.ts',
    'labs/nebula/packages/lab/src/server/workflows/stars/finite-model-star-context.ts'])).map(pin => [pin.path, pin.sha256]));
  const payload: PreparedLmcStars = { schema: 'cssearth-catalogue-stars@1', id: 'smc-stars', starIdPrefix: STAR_ID_PREFIX,
    frame: context.frame, magnitudeBand: 'V', stars: selection.stars,
    sourceUrl: 'https://cdsarc.cds.unistra.fr/viz-bin/cat/J/AJ/140/416',
    credit: 'Bonanos et al. (2010), AJ 140, 416; CDS/VizieR J/AJ/140/416',
    depthAssumption: 'Published J2000 angular positions held fixed; individual depths unmeasured. Depths sample the joint finite-model emission and simulation stellar density along each measured sightline. This model-contained display realization is not measured stellar distance or evidence of physical cloud membership.',
    provenance: { sources, bibcode: '2010AJ....140..416B', doi: '10.1088/0004-6256/140/2/416', photometry: STAR_PHOTOMETRY,
      finiteModel: { ...context.provenance, subjectId, lensRecipe: { path: finiteLensRecipe, sha256: sha256(recipeBytes) }, implementation,
        method: 'Conditional depth PDF proportional to maxRGB(finite components + simulation envelope, sampled as the model bake samples physical space, zero outside the baked box) times decoded simulation density times (1+z/D)^2. 1536 intervals span the baked depth range; a fixed SHA-256 source-ID quantile inverts its piecewise-linear CDF. Chosen points must have strictly positive emission and density, with an explicit zero-support gap guard.',
        coordinates: 'Measured ray -> model tangent plane (rayToOverlayPlane in the model frame); (x,y,z)=(x0*(1+z/D),y0*(1+z/D),z) kpc in the model frame.',
        support: 'cloudSignal is the model cutoff signal (aligned-image.png luminance, global maximum normalization) at the placed point; membership is the single all-light part. Stars below 8-bit signal quantization keep zero and stay visible at cutoff 0.' },
      selection: `Table 3 rows with finite RA, Dec and published V <= ${MAGNITUDE_LIMIT}, whose measured ray lands on a covered pixel of the model fit footprint (registered Horálek alpha >= 250, authored foreground exclusion removed). The separate OGLE V column is not substituted. Incomplete massive-star sample, not all SMC stars.`,
      inputRows: selection.inputRows, finiteVRows: selection.finiteV, brightRows: selection.brightV, footprintRows: selection.inFootprint,
      selectedRows: selection.stars.length, excludedNoJointSupport: selection.unsupported,
      belowSignalQuantization: selection.stars.filter(star => star.cloudSignal === 0).length,
      color: 'Published B-V mapped through the existing catalogue display-color approximation; white when B absent. No dereddening. Display size and opacity follow the shared magnitude response, not measured diameters.' } };
  parsePreparedLmcStars(payload, context.frame);
  const bytes = JSON.stringify(payload, null, 2) + '\n', output = preparedStarsPath(finiteLensRecipe);
  await mkdir(resolve(root, smcStarDirectory, 'prepared'), { recursive: true });
  await writeFile(resolve(root, output), bytes);
  // Model-owned external index beside the lens bundle: every lens of this model references the same prepared file.
  const index = { schema: 'cssearth-finite-model-stars@1', modelResultId: context.modelResultId, subjectId, stars: { path: output, sha256: sha256(bytes) } };
  await writeFile(resolve(root, finiteModelStarsIndex(context.modelResultId)), JSON.stringify(index, null, 2) + '\n');
  console.log(JSON.stringify({ prepared: output, recipe: finiteLensRecipe, index: finiteModelStarsIndex(context.modelResultId), modelResultId: context.modelResultId,
    inputRows: selection.inputRows, finiteV: selection.finiteV, brightV: selection.brightV, inFootprint: selection.inFootprint,
    selected: selection.stars.length, excluded: selection.unsupported.length, belowSignalQuantization: selection.stars.filter(s => s.cloudSignal === 0).length,
    magnitudeRange: [selection.stars[0]!.magnitude, selection.stars.at(-1)!.magnitude] }));
}
if (process.argv[1] && /^prepare-smc-stars\.(?:ts|mjs)$/.test(basename(process.argv[1]))) await prepareSmcStars(process.cwd(), process.argv[2]);
