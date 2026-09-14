/** Native source replay for a composite; the observation owner alone acquires or removes stars. */
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readObservationRecipe, scienceObservationSources } from '../../alignment/observations/recipe';
import { readObservations } from '../../alignment/observations-ui/model';
import { geometrySha } from '../geometry/registered-source';
import { jointPath, jointRecord } from '../joint-fit/model';
import { compilerLayersReady, runCompilerSourceCommand, type CompilerProgress } from './prerequisites';
import type { CompilerPin } from './bake-types';

const missing = (error: unknown) => error instanceof Error && 'code' in error && error.code === 'ENOENT';
function pin(path: unknown, sha256: unknown): CompilerPin {
  if (!jointPath(path) || typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(sha256))
    throw new TypeError('Missing native composite source pin.');
  return { path, sha256 };
}
export interface CompositeSourceRecipe { observationRecipe: string; observationCatalogue: string; detailSourceId: string; wideSourceId: string }

/** A preview catalogue alone is insufficient: require its source recipe and every full-native input. */
export async function opticalCompositeSourcePins(root: string, recipe: CompositeSourceRecipe): Promise<CompilerPin[] | undefined> {
  const recipeBytes = await readFile(resolve(root, recipe.observationRecipe)), observationsRecipe = readObservationRecipe(JSON.parse(recipeBytes.toString()));
  const planned = scienceObservationSources(observationsRecipe);
  if (recipe.observationCatalogue !== `.local/nebula-lab/observations/${observationsRecipe.id}/observations.json` ||
      planned.length !== 2 || !planned.some(source => source.id === recipe.detailSourceId) || !planned.some(source => source.id === recipe.wideSourceId))
    throw new TypeError('Composite observation recipe must own its two source identities and catalogue.');
  try {
    const catalogueBytes = await readFile(resolve(root, recipe.observationCatalogue)), raw: unknown = JSON.parse(catalogueBytes.toString());
    const catalogue = readObservations(raw);
    if (!jointRecord(raw) || !jointRecord(raw.provenance) || raw.provenance.recipeSha256 !== geometrySha(recipeBytes)) return undefined;
    if (!Array.isArray(raw.images) || catalogue.id !== observationsRecipe.id || catalogue.images.length !== planned.length ||
        catalogue.images.some(image => !planned.some(source => source.id === image.id && source.sha256 === image.source.sha256 &&
          source.width === image.source.width && source.height === image.source.height))) throw new TypeError('Composite catalogue differs from its pinned source recipe.');
    if (!await compilerLayersReady(root, raw)) return undefined;
    const pins: CompilerPin[] = [{ path: recipe.observationRecipe, sha256: geometrySha(recipeBytes) },
      { path: recipe.observationCatalogue, sha256: geometrySha(catalogueBytes) }];
    if (observationsRecipe.nativeSeparationCache) pins.push(observationsRecipe.nativeSeparationCache.recipe);
    for (const value of raw.images) {
      if (!jointRecord(value) || !jointRecord(value.source) || !jointRecord(value.removal) || !jointRecord(value.removal.settings)) return undefined;
      const { source, removal } = value, settings = removal.settings;
      if (!jointRecord(settings) || !jointPath(settings.directory) || !settings.directory.startsWith('.local/nebula-lab/'))
        throw new TypeError('Missing composite native separation owner.');
      if (!jointRecord(settings.model) || settings.scriptSha256 !== observationsRecipe.nativeRemoval.scriptSha256 ||
          settings.model.sha256 !== observationsRecipe.nativeRemoval.model.sha256)
        throw new TypeError('Composite native separation differs from its configured NOX model or code.');
      pins.push(pin(source.path, source.sha256), pin(`${settings.directory}/result.json`, removal.receiptSha256),
        pin(`${settings.directory}/diffuse.png`, removal.diffuseSha256), pin(`${settings.directory}/stars.png`, removal.residualSha256));
    }
    for (const source of pins) if (geometrySha(await readFile(resolve(root, source.path))) !== source.sha256)
      throw new Error(`Registered resource changed: ${source.path}`);
    return pins;
  } catch (error) { if (missing(error)) return undefined; throw error; }
}

export async function restoreOpticalCompositeSources(root: string, recipe: CompositeSourceRecipe, signal: AbortSignal, progress: CompilerProgress): Promise<CompilerPin[]> {
  signal.throwIfAborted();
  let pins = await opticalCompositeSourcePins(root, recipe);
  if (!pins) {
    progress('Restoring composite observations and native separation through their source recipe…');
    await runCompilerSourceCommand(root, 'prepare-observations', recipe.observationRecipe, 'NEBULA_OBSERVATIONS_COMPLETE', signal, progress);
    pins = await opticalCompositeSourcePins(root, recipe);
    if (!pins) throw new Error('Composite observation preparation did not restore its full native inputs.');
  } else progress('Composite registration and full-native separation reused.');
  const owner = 'labs/nebula/src/alignment/observations';
  const owners = ['labs/nebula/src/cli/prepare-observations.ts', 'labs/nebula/src/alignment/overlay-wcs.ts',
    'labs/nebula/src/reconstruction/emission-inference/native-source.ts', 'labs/nebula/src/star-removal/star-removal.py',
    ...(await readdir(resolve(root, owner))).filter(name => name.endsWith('.ts') && !name.endsWith('.test.ts')).sort().map(name => `${owner}/${name}`)];
  return [...pins, ...await Promise.all(owners.map(async path => ({ path, sha256: geometrySha(await readFile(resolve(root, path))) })))];
}
