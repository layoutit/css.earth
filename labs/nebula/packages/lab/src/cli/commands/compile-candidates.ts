/** Reproducible, serial candidate experiment; one failure does not conceal the other results. */
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readCompilerRecipe, compilerControlsForRecipe } from '../../features/compiler/model.ts';
import { compileNebula, validateCompilerResult } from '../../server/workflows/compiler/compile.ts';
import { jointRecord, jointPath } from '../../features/joint-fit/model.ts';
import { loadDepthModel } from '../../server/workflows/compiler/depth-model.ts';
import { sampledOwnerPins } from '../../features/sampled-prior/ownership.ts';
import { loadPhotometricPrior } from '../../server/workflows/compiler/photometric-prior.ts';

const [cataloguePath, ...args] = process.argv.slice(2);
if (!cataloguePath || args.some(arg => arg !== '--alignment-only' && !/^--object=[a-z0-9-]+$/.test(arg))) {
  throw new TypeError('Usage: compile-candidates <catalogue.json> [--alignment-only] [--object=<id>]');
}
const root = process.cwd(), alignmentOnly = args.includes('--alignment-only');
const requested = args.filter(arg => arg.startsWith('--object=')).map(arg => arg.slice(9));
const catalogue: unknown = JSON.parse(await readFile(cataloguePath, 'utf8'));
if (!jointRecord(catalogue) || catalogue.schema !== 'cssearth-nebula-candidates@1' || !Array.isArray(catalogue.candidates)) throw new TypeError('Invalid candidate catalogue.');
const candidates = catalogue.candidates.map((row: unknown) => {
  if (!jointRecord(row) || typeof row.id !== 'string' || !/^[a-z0-9-]+$/.test(row.id) || !jointPath(row.compilerRecipe) ||
      !row.compilerRecipe.startsWith('labs/nebula/models/')) throw new TypeError('Invalid candidate recipe.');
  return { id: row.id, compilerRecipe: row.compilerRecipe };
});
if (new Set(candidates.map(row => row.id)).size !== candidates.length || requested.some(id => !candidates.some(row => row.id === id))) throw new TypeError('Duplicate or unknown candidate.');
const selected = candidates.filter(row => !requested.length || requested.includes(row.id));
if (!selected.length) throw new TypeError('No candidates selected.');
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const pin = async (path: string) => ({ path, sha256: sha(await readFile(resolve(root, path))) });
const save = async (path: string, data: unknown) => {
  await writeFile(`${path}.pending`, JSON.stringify(data, null, 2) + '\n'); await rename(`${path}.pending`, path);
};
const output = resolve(root, '.local/nebula-lab/candidate-runs');
const published = resolve(root, '.local/nebula-lab/compiler-published');
await mkdir(output, { recursive: true }); await mkdir(published, { recursive: true });
const controller = new AbortController();
process.once('SIGINT', () => controller.abort(new Error('Candidate batch cancelled.')));
process.once('SIGTERM', () => controller.abort(new Error('Candidate batch cancelled.')));
const results: unknown[] = [], startedAt = new Date().toISOString();
const receipt = resolve(output, `${Date.now()}-${alignmentOnly ? 'alignment' : 'compile'}.json`);
let failures = 0;
for (const candidate of selected) {
  controller.signal.throwIfAborted();
  const started = performance.now(); console.log(`CANDIDATE_START ${candidate.id}`);
  try {
    const recipe = readCompilerRecipe(JSON.parse(await readFile(candidate.compilerRecipe, 'utf8')));
    if (recipe.id !== candidate.id) throw new TypeError('Candidate and compiler identity differ.');
    if (alignmentOnly) {
      await new Promise<void>((accept, reject) => {
        const child = spawn(process.execPath, ['--experimental-strip-types', 'labs/nebula/run.mts', 'prepare-observations', recipe.observationRecipe, '--alignment-only'],
          { cwd: root, stdio: ['ignore', 'pipe', 'inherit'], signal: controller.signal });
        let complete = false, tail = '';
        child.stdout.on('data', (bytes: Buffer) => { process.stdout.write(bytes); tail = (tail + bytes.toString()).slice(-8192); complete ||= tail.includes('NEBULA_OBSERVATIONS_COMPLETE'); });
        child.once('error', reject);
        child.once('exit', code => code === 0 && complete ? accept() : reject(new Error(`Alignment failed (${code}); completion=${complete}.`)));
      });
      results.push({ id: candidate.id, status: 'aligned', catalogue: await pin(recipe.observationCatalogue), seconds: (performance.now() - started) / 1000 });
    } else {
      let lastProgress = '';
      const result = await compileNebula(root, { action: 'apply', imageId: 'compiler', recipePath: candidate.compilerRecipe,
        cataloguePath: recipe.structureCatalogue, controls: compilerControlsForRecipe(recipe), imageToFrame: {}, evidence: { sensitivity: 1, weights: [] } },
      controller.signal, (message, fraction) => {
        const line = `${candidate.id} ${Math.round((fraction ?? 0) * 100)}% ${message}`;
        if (line !== lastProgress) { console.log(line); lastProgress = line; }
      });
      await validateCompilerResult(root, result);
      const resultPin = await pin(`.local/nebula-lab/compiler/${result.id}/result.json`);
      const inputPaths = [candidate.compilerRecipe, recipe.observationRecipe, recipe.observationCatalogue, recipe.structureRecipe, recipe.structureCatalogue];
      if (recipe.jointRecipe) inputPaths.push(recipe.jointRecipe);
      if (recipe.observedStars) inputPaths.push(recipe.observedStars.path);
      const depth = recipe.depthRecipe ? await loadDepthModel(root, recipe.depthRecipe, recipe.id) : undefined;
      if (depth) inputPaths.push(depth.recipePath, depth.recipe.evidence.path);
      const photometric = recipe.photometricPriorRecipe ? await loadPhotometricPrior(root, recipe.photometricPriorRecipe, recipe.id) : undefined;
      if (photometric && recipe.photometricPriorRecipe) inputPaths.push(recipe.photometricPriorRecipe, photometric.recipe.evidence.path);
      const method: unknown = JSON.parse(await readFile(result.method.path, 'utf8'));
      if (!jointRecord(method) || !Array.isArray(method.implementation)) throw new TypeError('Missing compiler implementation identity.');
      const sampledOwners = recipe.sampledRecipe ? sampledOwnerPins(method, recipe.sampledRecipe) : [];
      inputPaths.push(...sampledOwners.map(owner => owner.path));
      if (depth && (!jointRecord(method.physicalDepth) || !jointRecord(method.physicalDepth.recipe) || !jointRecord(method.physicalDepth.evidence) ||
          method.physicalDepth.recipe.sha256 !== depth.recipeSha256 || method.physicalDepth.evidence.sha256 !== (await pin(depth.recipe.evidence.path)).sha256))
        throw new TypeError('Compiled depth sources differ from the configured recipe or evidence.');
      if (photometric && (!jointRecord(method.photometricPrior) || !jointRecord(method.photometricPrior.recipe) || !jointRecord(method.photometricPrior.evidence) ||
          method.photometricPrior.recipe.sha256 !== photometric.recipeSha256 || method.photometricPrior.evidence.sha256 !== (await pin(photometric.recipe.evidence.path)).sha256))
        throw new TypeError('Compiled photometric sources differ from the configured model or evidence.');
      for (const owner of method.implementation) {
        if (!jointRecord(owner) || !jointPath(owner.path) || typeof owner.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(owner.sha256))
          throw new TypeError('Invalid compiler implementation owner. Compile again with the current implementation.');
        const current = await pin(owner.path);
        if (current.sha256 !== owner.sha256) throw new TypeError('Compiler implementation changed during publication. Compile again.');
        if (!inputPaths.includes(owner.path)) inputPaths.push(owner.path);
      }
      const inputs = await Promise.all(inputPaths.map(pin));
      if (sampledOwners.some(owner => !inputs.some(input => input.path === owner.path && input.sha256 === owner.sha256)))
        throw new TypeError('Sampled inputs changed during preparation. Compile again.');
      if (depth && inputs.find(source => source.path === depth.recipePath)?.sha256 !== depth.recipeSha256)
        throw new TypeError('Depth inputs changed during publication. Compile again.');
      if (photometric && inputs.find(source => source.path === recipe.photometricPriorRecipe)?.sha256 !== photometric.recipeSha256)
        throw new TypeError('Photometric inputs changed during publication. Compile again.');
      await save(resolve(published, `${candidate.id}.json`), { schema: 'cssearth-nebula-compiler-published@1', recipePath: candidate.compilerRecipe,
        result: resultPin, inputs });
      results.push({ id: candidate.id, status: 'complete', result: resultPin, metrics: result.metrics, seconds: (performance.now() - started) / 1000 });
    }
    console.log(`CANDIDATE_COMPLETE ${candidate.id}`);
  } catch (error) {
    failures++; const message = error instanceof Error ? error.message : String(error);
    results.push({ id: candidate.id, status: 'failed', error: message, seconds: (performance.now() - started) / 1000 });
    console.error(`CANDIDATE_FAILED ${candidate.id}: ${message}`);
  }
  await save(receipt, { schema: 'cssearth-nebula-candidate-run@1', startedAt, updatedAt: new Date().toISOString(),
    catalogue: await pin(cataloguePath), mode: alignmentOnly ? 'alignment' : 'compile', selected: selected.map(row => row.id), results });
}
console.log(`CANDIDATE_BATCH_COMPLETE ${selected.length - failures}/${selected.length}; receipt=${receipt}`);
process.exitCode = failures ? 1 : 0;
