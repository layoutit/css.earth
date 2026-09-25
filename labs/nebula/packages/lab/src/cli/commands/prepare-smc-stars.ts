/** Offline preparation of the published Bonanos et al. (2010) massive SMC star sample inside the current finite SMC model. */
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { STAR_PHOTOMETRY, type PreparedLmcStars } from '@cssearth/bake/volume';
import { parseLabModelJson } from '../../resources/model-paths.ts';
import { loadFiniteModelStarContext, type FiniteModelStarContext } from '../../server/workflows/stars/finite-model-star-context.ts';
import { placeCatalogueStarsInFiniteModel, preparedStarsLayerPath, readFiniteLensRecipe, finiteModelSubjectId,
  readPinnedCatalogueFiles, finiteModelStarProvenance, writeFiniteModelStarLayer, finiteModelStarsIndex,
  FINITE_STAR_COLOR, MAGNITUDE_LIMIT, type CatalogueStarRow, type FiniteStarSelection,
} from '../../server/workflows/stars/finite-model-star-layer.ts';

export const smcStarDirectory = 'labs/nebula/models/smc/stars';
export const STAR_ID_PREFIX = 'Bonanos2010:';
export const COMMAND = 'labs/nebula/packages/lab/src/cli/commands/prepare-smc-stars.ts';
export { finiteModelStarsIndex, MAGNITUDE_LIMIT };
export type SmcStarSelection = FiniteStarSelection;
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** CDS J/AJ/140/416 table3.dat bytes (1-based, inclusive) from the pinned ReadMe. Blank optional fields are NaN. */
export function readBonanos2010Row(line: string): CatalogueStarRow {
  const field = (first: number, last: number) => line.slice(first - 1, last).trim();
  const number = (first: number, last: number) => { const text = field(first, last); return text ? Number(text) : NaN; };
  return { name: field(1, 17), raDeg: number(84, 92), decDeg: number(94, 102), bmag: number(117, 122), vmag: number(130, 135),
    spectralType: field(315, 348) };
}

/** The shared finite-model placement, reading this catalogue's own published columns. */
export const prepareSmcCatalogue = (table: string, context: FiniteModelStarContext): SmcStarSelection =>
  placeCatalogueStarsInFiniteModel(table, context, { starIdPrefix: STAR_ID_PREFIX, readRow: readBonanos2010Row });

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
export const preparedStarsPath = (finiteLensRecipe: string) => preparedStarsLayerPath(smcStarDirectory, finiteLensRecipe);

export async function prepareSmcStars(root = process.cwd(), recipePath?: string) {
  const manifest = await readSmcStarManifest(root);
  // The recipe names the model; the manifest holds the default, and a second recipe is passed explicitly. No result id is hard-coded.
  const finiteLensRecipe = recipePath ?? manifest.finiteLensRecipe;
  if (finiteLensRecipe !== manifest.finiteLensRecipe && (!/^labs\/nebula\/models\/smc\/constrained\/[A-Za-z0-9._-]+\.json$/.test(finiteLensRecipe)))
    throw new TypeError('A star layer recipe must be a checked-in SMC lens recipe.');
  const sources = await readPinnedCatalogueFiles(root, `${smcStarDirectory}/source`, manifest.files);
  const recipe = await readFiniteLensRecipe(root, finiteLensRecipe);
  const context = await loadFiniteModelStarContext(root, recipe.modelResultId);
  const subjectId = await finiteModelSubjectId(root, context.modelResultId);
  const table = await readFile(resolve(root, smcStarDirectory, 'source/table3.dat'), 'utf8');
  const selection = prepareSmcCatalogue(table, context);
  if (selection.inputRows !== 3654 || selection.stars.length < 100) throw new Error(`Unexpected catalogue sample: ${JSON.stringify({ ...selection, stars: selection.stars.length })}`);
  const finiteModel = await finiteModelStarProvenance(root, { context, subjectId, command: COMMAND,
    lensRecipe: { path: finiteLensRecipe, sha256: recipe.sha256 } });
  const payload: PreparedLmcStars = { schema: 'cssearth-catalogue-stars@1', id: 'smc-stars', starIdPrefix: STAR_ID_PREFIX,
    frame: context.frame, magnitudeBand: 'V', stars: selection.stars,
    sourceUrl: 'https://cdsarc.cds.unistra.fr/viz-bin/cat/J/AJ/140/416',
    credit: 'Bonanos et al. (2010), AJ 140, 416; CDS/VizieR J/AJ/140/416',
    depthAssumption: 'Published J2000 angular positions held fixed; individual depths unmeasured. Depths sample the joint finite-model emission and simulation stellar density along each measured sightline. This model-contained display realization is not measured stellar distance or evidence of physical cloud membership.',
    provenance: { sources, bibcode: '2010AJ....140..416B', doi: '10.1088/0004-6256/140/2/416', photometry: STAR_PHOTOMETRY,
      finiteModel,
      selection: `Table 3 rows with finite RA, Dec and published V <= ${MAGNITUDE_LIMIT}, whose measured ray lands on a covered pixel of the model fit footprint (registered Horálek alpha >= 250, authored foreground exclusion removed). The separate OGLE V column is not substituted. Incomplete massive-star sample, not all SMC stars.`,
      inputRows: selection.inputRows, finiteVRows: selection.finiteV, brightRows: selection.brightV, footprintRows: selection.inFootprint,
      selectedRows: selection.stars.length, excludedNoJointSupport: selection.unsupported,
      belowSignalQuantization: selection.stars.filter(star => star.cloudSignal === 0).length,
      color: FINITE_STAR_COLOR } };
  const output = preparedStarsPath(finiteLensRecipe);
  const written = await writeFiniteModelStarLayer(root, { context, subjectId, output, payload });
  console.log(JSON.stringify({ prepared: output, recipe: finiteLensRecipe, index: written.index, modelResultId: context.modelResultId,
    inputRows: selection.inputRows, finiteV: selection.finiteV, brightV: selection.brightV, inFootprint: selection.inFootprint,
    selected: selection.stars.length, excluded: selection.unsupported.length, belowSignalQuantization: selection.stars.filter(s => s.cloudSignal === 0).length,
    magnitudeRange: [selection.stars[0]!.magnitude, selection.stars.at(-1)!.magnitude] }));
}
if (process.argv[1] && /^prepare-smc-stars\.(?:ts|mjs)$/.test(basename(process.argv[1]))) await prepareSmcStars(process.cwd(), process.argv[2]);
