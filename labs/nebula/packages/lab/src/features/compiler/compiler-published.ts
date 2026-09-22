import { readCompilerRecipe, readCompilerRequest, type CompilerRequest } from './model.ts';
import { readCompilerResult, type CompilerResult } from './result.ts';
import { sampledOwnerPins } from '../sampled-prior/ownership.ts';
import { readSampledRecipe, verifySampledEvidence } from '../sampled-prior/model.ts';

interface Pin { path: string }
interface Published { recipePath: string; result: Pin; inputs: Pin[] }
/** Producer identities are historical metadata; scientific recipes/outputs never match this policy. */
function producerPath(path: string): boolean {
  return /^labs\/nebula\/(?:src\/.+\.[cm]?tsx?|packages\/(?:lab|volume-core|volume-bake|reconstruction)\/(?:src\/.+\.[cm]?tsx?|package\.json))$/.test(path) ||
    /^src\/(?:preparation|renderers|platform)\/.+\.[cm]?ts$/.test(path) ||
    /^tools\/(?:(?:fits|fits-sky|source-values)\.mts|(?:nebula\/application|objects)\/.+\.[cm]?ts)$/.test(path);
}
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
function pin(value: unknown): Pin {
  if (!record(value) || typeof value.path !== 'string' || !(/^(?:labs\/nebula\/|\.local\/nebula-lab\/)/.test(value.path) || producerPath(value.path)) ||
      value.path.split('/').some(part => part === '..' || part === '.' || part === '') || /[\\?#\s]/.test(value.path)) throw new TypeError('Invalid prepared compiler pin.');
  return { path: value.path };
}
export function readPublishedCompiler(value: unknown, recipePath: string): Published {
  if (!record(value) || value.schema !== 'cssearth-nebula-compiler-published@1' || value.recipePath !== recipePath ||
      !Array.isArray(value.inputs) || value.inputs.length < 5 || value.inputs.length > 200) throw new TypeError('Invalid prepared compiler publication.');
  const inputs = value.inputs.map(pin), result = pin(value.result);
  if (new Set(inputs.map(item => item.path)).size !== inputs.length || !inputs.some(item => item.path === recipePath) ||
      !/^\.local\/nebula-lab\/compiler\/[a-f0-9]{64}\/result\.json$/.test(result.path)) throw new TypeError('Prepared compiler publication has incomplete source ownership.');
  return { recipePath, result, inputs };
}
type FetchLocal = (path: string) => Promise<Response>;
async function localBytes(path: string, fetchLocal: FetchLocal): Promise<Uint8Array> {
  const response = await fetchLocal(path);
  if (!response.ok) throw new Error(`Prepared compiler input is missing: ${path}`);
  return new Uint8Array(await response.arrayBuffer());
}
const checkedBytes = (source: Pin, fetchLocal: FetchLocal): Promise<Uint8Array> => localBytes(source.path, fetchLocal);
/** Inspect immutable outputs against current scientific inputs; code pins document the historical producer. */
export async function loadPublishedCompiler(path: string, recipePath: string, fetchLocal: FetchLocal, expected?: CompilerRequest): Promise<CompilerResult | null> {
  const response = await fetchLocal(path);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Prepared nebula receipt is unavailable.');
  const publication = readPublishedCompiler(await response.json(), recipePath);
  // Preparing code can evolve while a saved cloud remains inspectable. Never replace its recorded producer hashes.
  const inputs = await Promise.all(publication.inputs.filter(source => !producerPath(source.path))
    .map(async source => [source.path, await checkedBytes(source, fetchLocal)] as const));
  const recipeBytes = inputs.find(([path]) => path === recipePath)![1];
  const recipe = readCompilerRecipe(JSON.parse(new TextDecoder().decode(recipeBytes)));
  const required = [recipe.observationRecipe, recipe.observationCatalogue, recipe.structureRecipe, recipe.structureCatalogue,
    ...(recipe.observedStars ? [recipe.observedStars.path] : []), ...(recipe.jointRecipe ? [recipe.jointRecipe] : []), ...(recipe.depthRecipe ? [recipe.depthRecipe] : []), ...(recipe.sampledRecipe ? [recipe.sampledRecipe] : []),
    ...(recipe.photometricPriorRecipe ? [recipe.photometricPriorRecipe] : [])];
  if (required.some(path => !inputs.some(([candidate]) => candidate === path))) throw new Error('Prepared nebula receipt does not pin every configured source.');
  let depthInputs: { recipe: Pin; evidence: Pin } | undefined;
  if (recipe.depthRecipe) {
    const depth: unknown = JSON.parse(new TextDecoder().decode(inputs.find(([path]) => path === recipe.depthRecipe)![1]));
    if (!record(depth) || depth.schema !== 'cssearth-nebula-depth-model@1' || depth.id !== recipe.id)
      throw new Error('Prepared depth recipe belongs to another nebula or has an invalid schema.');
    const evidence = pin(depth.evidence);
    if (!evidence.path.startsWith('labs/nebula/models/') || !publication.inputs.some(source => source.path === evidence.path))
      throw new Error('Prepared nebula receipt does not pin the declared depth evidence.');
    const ledger: unknown = JSON.parse(new TextDecoder().decode(inputs.find(([path]) => path === evidence.path)![1]));
    if (!record(ledger) || ledger.schema !== 'cssearth-nebula-physical-evidence@1' || ledger.subjectId !== recipe.id ||
        !Array.isArray(ledger.sources) || !Array.isArray(ledger.evidence) || !Array.isArray(ledger.methods))
      throw new Error('Prepared physical evidence ledger belongs to another nebula or has an invalid schema.');
    depthInputs = { recipe: publication.inputs.find(source => source.path === recipe.depthRecipe)!, evidence };
  }
  const result = readCompilerResult(JSON.parse(new TextDecoder().decode(await checkedBytes(publication.result, fetchLocal))));
  if (publication.result.path !== `.local/nebula-lab/compiler/${result.id}/result.json` || result.defaultSourceId !== recipe.defaultSourceId)
    throw new Error('Prepared nebula result does not match its configured recipe.');
  const method: unknown = JSON.parse(new TextDecoder().decode(await localBytes(result.method.path, fetchLocal)));
  if (!record(method) || !Array.isArray(method.implementation))
    throw new Error('Prepared nebula method does not match its current recipe.');
  if (recipe.photometricPriorRecipe) {
    const model: unknown = JSON.parse(new TextDecoder().decode(inputs.find(([path]) => path === recipe.photometricPriorRecipe)![1]));
    if (!record(model) || model.schema !== 'cssearth-photometric-mge@1' || model.id !== recipe.id || !record(method.photometricPrior))
      throw new Error('Prepared nebula omits its configured photometric model.');
    const evidence = pin(model.evidence), snapshot = pin(method.photometricPrior.recipe), evidenceSnapshot = pin(method.photometricPrior.evidence);
    if (!evidence.path.startsWith('labs/nebula/models/') ||
        !publication.inputs.some(input => input.path === evidence.path))
      throw new Error('Prepared photometric model differs from its configured evidence.');
    await Promise.all([checkedBytes(snapshot, fetchLocal), checkedBytes(evidenceSnapshot, fetchLocal)]);
  }
  if (recipe.observedStars && (!record(method.observedStars) || !record(method.observedStars.source) ||
      method.observedStars.source.path !== recipe.observedStars.path ||
      !publication.inputs.some(input => input.path === recipe.observedStars!.path)))
    throw new Error('Prepared stellar catalogue differs from its configured source.');
  if (recipe.sampledRecipe) {
    for (const owner of sampledOwnerPins(method, recipe.sampledRecipe)) if (!publication.inputs.some(input => input.path === owner.path))
      throw new Error('Prepared spatial model is missing a source or implementation pin.');
    const sampled = readSampledRecipe(JSON.parse(new TextDecoder().decode(inputs.find(([path]) => path === recipe.sampledRecipe)![1])));
    if (sampled.id !== recipe.id || !publication.inputs.some(p => p.path === sampled.source.path) ||
        !publication.inputs.some(p => p.path === sampled.evidence.path))
      throw new Error('Prepared spatial model uses different qualified sources.');
    verifySampledEvidence(sampled, JSON.parse(new TextDecoder().decode(inputs.find(([path]) => path === sampled.evidence.path)![1])));
  }
  if (depthInputs) {
    if (!record(method.physicalDepth)) throw new Error('Prepared nebula method omits the configured depth sources.');
    const recipeSnapshot = pin(method.physicalDepth.recipe), evidenceSnapshot = pin(method.physicalDepth.evidence);
    if (!recipeSnapshot.path.startsWith('.local/nebula-lab/') || !evidenceSnapshot.path.startsWith('.local/nebula-lab/'))
      throw new Error('Prepared nebula method uses different depth sources. Compile again.');
    await Promise.all([checkedBytes(recipeSnapshot, fetchLocal), checkedBytes(evidenceSnapshot, fetchLocal)]);
  }
  const request = readCompilerRequest(method.request);
  if (request.recipePath !== recipePath || request.cataloguePath !== recipe.structureCatalogue || JSON.stringify(request.controls) !== JSON.stringify(result.controls))
    throw new Error('Prepared nebula method belongs to different inputs or controls.');
  if (expected) {
    const desired = readCompilerRequest(expected);
    if (desired.recipePath !== request.recipePath || desired.cataloguePath !== request.cataloguePath ||
      JSON.stringify(desired.controls) !== JSON.stringify(request.controls) || JSON.stringify(desired.evidence) !== JSON.stringify(request.evidence)) return null;
    const observations: unknown = JSON.parse(new TextDecoder().decode(inputs.find(([path]) => path === recipe.observationCatalogue)![1]));
    for (const [id, matrix] of Object.entries(desired.imageToFrame)) {
      const image: unknown = record(observations) && Array.isArray(observations.images) ? observations.images.find((row: unknown) => record(row) && row.id === id) : undefined;
      const original: unknown = request.imageToFrame[id] ?? (record(image) ? image.imageToFrame : undefined);
      if (!Array.isArray(original) || original.length !== matrix.length || matrix.some((n, i) => n !== original[i])) return null;
    }
  }
  for (const implementation of method.implementation) {
    if (!record(implementation)) throw new Error('Invalid prepared nebula implementation.');
    const path = typeof implementation.path === 'string' ? implementation.path :
      typeof implementation.name === 'string' && /^[a-z0-9-]+\.ts$/.test(implementation.name)
        ? `labs/nebula/src/reconstruction/compiler/${implementation.name}` : '';
    if (!producerPath(path) || !publication.inputs.some(input => input.path === path))
      throw new Error('Prepared nebula implementation differs from its published receipt.');
  }
  return result;
}
