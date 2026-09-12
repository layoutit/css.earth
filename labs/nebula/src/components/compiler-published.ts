import { readCompilerRecipe, readCompilerRequest } from '../reconstruction/compiler/model';
import { readCompilerResult, type CompilerResult } from '../reconstruction/compiler/result';

interface Pin { path: string; sha256: string }
interface Published { recipePath: string; result: Pin; inputs: Pin[] }
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
function pin(value: unknown): Pin {
  if (!record(value) || typeof value.path !== 'string' || !/^(?:labs\/nebula\/|\.local\/nebula-lab\/)/.test(value.path) ||
      value.path.split('/').some(part => part === '..' || part === '') || /[\\?#\s]/.test(value.path) ||
      typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.sha256)) throw new TypeError('Invalid prepared compiler pin.');
  return { path: value.path, sha256: value.sha256 };
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
async function checkedBytes(source: Pin, fetchLocal: FetchLocal): Promise<Uint8Array> {
  const response = await fetchLocal(source.path);
  if (!response.ok) throw new Error(`Prepared compiler input is missing: ${source.path}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('');
  if (hash !== source.sha256) throw new Error('Prepared nebula sources changed. Compile again.');
  return bytes;
}
/** A CLI result is inspectable only while its configured inputs retain their saved hashes. */
export async function loadPublishedCompiler(path: string, recipePath: string, fetchLocal: FetchLocal): Promise<CompilerResult | null> {
  const response = await fetchLocal(path);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Prepared nebula receipt is unavailable.');
  const publication = readPublishedCompiler(await response.json(), recipePath);
  const inputs = await Promise.all(publication.inputs.map(async source => [source.path, await checkedBytes(source, fetchLocal)] as const));
  const recipeBytes = inputs.find(([path]) => path === recipePath)![1];
  const recipe = readCompilerRecipe(JSON.parse(new TextDecoder().decode(recipeBytes)));
  const required = [recipe.observationRecipe, recipe.observationCatalogue, recipe.structureRecipe, recipe.structureCatalogue, ...(recipe.jointRecipe ? [recipe.jointRecipe] : [])];
  if (required.some(path => !inputs.some(([candidate]) => candidate === path))) throw new Error('Prepared nebula receipt does not pin every configured source.');
  const result = readCompilerResult(JSON.parse(new TextDecoder().decode(await checkedBytes(publication.result, fetchLocal))));
  if (publication.result.path !== `.local/nebula-lab/compiler/${result.id}/result.json` || result.defaultSourceId !== recipe.defaultSourceId)
    throw new Error('Prepared nebula result does not match its configured recipe.');
  const method: unknown = JSON.parse(new TextDecoder().decode(await checkedBytes(result.method, fetchLocal)));
  if (!record(method) || method.recipeSha256 !== publication.inputs.find(source => source.path === recipePath)!.sha256 || !Array.isArray(method.implementation))
    throw new Error('Prepared nebula method does not match its current recipe.');
  const request = readCompilerRequest(method.request);
  if (request.recipePath !== recipePath || request.cataloguePath !== recipe.structureCatalogue || JSON.stringify(request.controls) !== JSON.stringify(result.controls))
    throw new Error('Prepared nebula method belongs to different inputs or controls.');
  for (const implementation of method.implementation) {
    if (!record(implementation) || typeof implementation.name !== 'string' || !/^[a-z0-9-]+\.ts$/.test(implementation.name) ||
        !publication.inputs.some(input => input.path === `labs/nebula/src/reconstruction/compiler/${implementation.name}` && input.sha256 === implementation.sha256))
      throw new Error('Prepared nebula implementation changed. Compile again.');
  }
  return result;
}
