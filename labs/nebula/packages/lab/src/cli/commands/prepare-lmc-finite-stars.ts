/**
 * Offline preparation of the published Bonanos et al. (2009) massive LMC star sample inside the current
 * finite LMC emission model, through the shared finite-model star placement.
 *
 * The historical `prepare-lmc-stars` layer (prepared/stars.json) belongs to the repainted
 * alignment-density cloud and stays untouched; this command writes the layer of the two-scale
 * envelope models beside it.
 */
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { STAR_PHOTOMETRY, type PreparedLmcStars } from '@cssearth/bake/volume';
import { parseLabModelJson } from '../../resources/model-paths.ts';
import { loadFiniteModelStarContext, type FiniteModelStarContext } from '../../server/workflows/stars/finite-model-star-context.ts';
import { placeCatalogueStarsInFiniteModel, preparedStarsLayerPath, readFiniteLensRecipe, finiteModelSubjectId,
  readPinnedCatalogueFiles, finiteModelStarProvenance, writeFiniteModelStarLayer, finiteModelStarsIndex,
  FINITE_STAR_COLOR, MAGNITUDE_LIMIT, type CatalogueStarRow, type FiniteStarSelection,
} from '../../server/workflows/stars/finite-model-star-layer.ts';

export const lmcStarDirectory = 'labs/nebula/models/lmc/stars';
export const STAR_ID_PREFIX = 'Bonanos2009:';
export const COMMAND = 'labs/nebula/packages/lab/src/cli/commands/prepare-lmc-finite-stars.ts';
/**
 * The checked-in lens recipe of the two-scale envelope model. It is named here rather than in
 * `source/catalogue.json` because that manifest is byte-pinned as LMC object evidence and still
 * describes the repaint depth model; when the envelope model is promoted the default belongs there,
 * as the SMC's does.
 */
export const DEFAULT_LENS_RECIPE = 'labs/nebula/models/lmc/envelope/finite-lenses.json';
/** prepared/stars.json is the historical repaint layer, so the finite-model layers take their own base name. */
export const LAYER_BASE_NAME = 'stars-envelope';
/** Published rows in the pinned table3.dat. */
export const INPUT_ROWS = 1268;
export { finiteModelStarsIndex, MAGNITUDE_LIMIT };
export type LmcStarSelection = FiniteStarSelection;
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** CDS J/AJ/138/1003 table3.dat bytes (1-based, inclusive) from the pinned ReadMe. Blank optional fields are NaN. */
export function readBonanos2009Row(line: string): CatalogueStarRow {
  const field = (first: number, last: number) => line.slice(first - 1, last).trim();
  const number = (first: number, last: number) => { const text = field(first, last); return text ? Number(text) : NaN; };
  return { name: field(1, 18), raDeg: number(40, 49), decDeg: number(51, 61), bmag: number(76, 81), vmag: number(89, 94),
    spectralType: field(274, 305) };
}

/** The shared finite-model placement, reading this catalogue's own published columns. */
export const prepareLmcFiniteCatalogue = (table: string, context: FiniteModelStarContext): LmcStarSelection =>
  placeCatalogueStarsInFiniteModel(table, context, { starIdPrefix: STAR_ID_PREFIX, readRow: readBonanos2009Row });

export async function readLmcStarManifest(root: string) {
  const manifest: unknown = parseLabModelJson(await readFile(resolve(root, lmcStarDirectory, 'source/catalogue.json'), 'utf8'));
  if (!record(manifest) || manifest.schema !== 'cssearth-pinned-catalogue@1' || manifest.catalogue !== 'J/AJ/138/1003' ||
      !Array.isArray(manifest.files)) throw new TypeError('Invalid LMC star catalogue manifest.');
  const files = manifest.files.map(entry => {
    if (!record(entry) || typeof entry.path !== 'string' || !/^[A-Za-z0-9._-]+$/.test(entry.path) || typeof entry.sha256 !== 'string' ||
        typeof entry.url !== 'string' || !entry.url.startsWith('https://cdsarc.cds.unistra.fr/ftp/J/AJ/138/1003/')) throw new TypeError('Invalid catalogue file pin.');
    return { path: entry.path, sha256: entry.sha256, url: entry.url };
  });
  return { files };
}

/** finite-lenses.json -> stars-envelope.json, finite-lenses-<name>.json -> stars-envelope-<name>.json. */
export const preparedStarsPath = (finiteLensRecipe: string) => preparedStarsLayerPath(lmcStarDirectory, finiteLensRecipe, LAYER_BASE_NAME);

export async function prepareLmcFiniteStars(root = process.cwd(), recipePath?: string) {
  const manifest = await readLmcStarManifest(root);
  // The recipe names the model; a re-fit updates the recipe and this command follows. No result id is hard-coded.
  const finiteLensRecipe = recipePath ?? DEFAULT_LENS_RECIPE;
  if (!/^labs\/nebula\/models\/lmc\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+\.json$/.test(finiteLensRecipe))
    throw new TypeError('A star layer recipe must be a checked-in LMC lens recipe.');
  const sources = await readPinnedCatalogueFiles(root, `${lmcStarDirectory}/source`, manifest.files);
  const recipe = await readFiniteLensRecipe(root, finiteLensRecipe);
  const context = await loadFiniteModelStarContext(root, recipe.modelResultId);
  const subjectId = await finiteModelSubjectId(root, context.modelResultId);
  const table = await readFile(resolve(root, lmcStarDirectory, 'source/table3.dat'), 'utf8');
  const selection = prepareLmcFiniteCatalogue(table, context);
  if (selection.inputRows !== INPUT_ROWS || selection.stars.length < 100)
    throw new Error(`Unexpected catalogue sample: ${JSON.stringify({ ...selection, stars: selection.stars.length })}`);
  const finiteModel = await finiteModelStarProvenance(root, { context, subjectId, command: COMMAND,
    lensRecipe: { path: finiteLensRecipe, sha256: recipe.sha256 } });
  const payload: PreparedLmcStars = { schema: 'cssearth-catalogue-stars@1', id: 'lmc-stars', starIdPrefix: STAR_ID_PREFIX,
    frame: context.frame, magnitudeBand: 'V', stars: selection.stars,
    sourceUrl: 'https://cdsarc.cds.unistra.fr/viz-bin/cat/J/AJ/138/1003',
    credit: 'Bonanos et al. (2009), AJ 138, 1003; CDS/VizieR J/AJ/138/1003',
    depthAssumption: 'Published J2000 angular positions held fixed; individual depths unmeasured. Depths sample the joint finite-model emission and simulation stellar density along each measured sightline. This model-contained display realization is not measured stellar distance or evidence of physical cloud membership.',
    provenance: { sources, bibcode: '2009AJ....138.1003B', doi: '10.1088/0004-6256/138/4/1003',
      paperUrl: 'https://arxiv.org/abs/0905.1328', photometry: STAR_PHOTOMETRY,
      finiteModel,
      selection: `Table 3 rows with finite RA, Dec and published Johnson V <= ${MAGNITUDE_LIMIT}, whose measured ray lands on a covered pixel of the model fit footprint (registered Horálek wide-field alpha >= 250; this fit authors no exclusions). The separate OGLE V column is not substituted. Incomplete massive-star sample, not all LMC stars.`,
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
if (process.argv[1] && /^prepare-lmc-finite-stars\.(?:ts|mjs)$/.test(basename(process.argv[1]))) await prepareLmcFiniteStars(process.cwd(), process.argv[2]);
