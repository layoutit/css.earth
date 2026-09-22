import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { readObservations } from '../../../features/observations/models/model.ts';
import { readStructureCatalogue } from '../../../features/observations/models/structures-model.ts';
import { geometrySha, readGeometryPin, readRegisteredGeometrySource } from '../geometry/registered-source.ts';
import { acquireMolecularSources } from '../kinematics/molecular-source.ts';
import { readJointRecipe, jointRecord } from '../../../features/joint-fit/model.ts';
import type { CompilerRecipe } from '../../../features/compiler/model.ts';
export interface CompilerStep { id: string; label: string; state: 'reused' | 'complete'; seconds: number }
export type CompilerProgress = (message: string, fraction?: number) => void;
const missing = (error: unknown) => error instanceof Error && 'code' in error && error.code === 'ENOENT';
async function present(root: string, path: string) { try { await access(resolve(root, path)); return true; } catch (error) { if (missing(error)) return false; throw error; } }

/** Missing derived files are restorable; changed hashes are evidence errors, never silently overwritten. */
export async function compilerLayersReady(root: string, value: unknown): Promise<boolean> {
  readObservations(value);
  if (!jointRecord(value) || !Array.isArray(value.images)) throw new TypeError('Missing observation images.');
  for (const image of value.images) {
    if (!jointRecord(image) || !jointRecord(image.layers)) throw new TypeError('Missing observation layers.');
    for (const name of ['original', 'diffuse', 'stars'] as const) {
      const layer = image.layers[name]; if (!layer) return false;
      if (!jointRecord(layer) || typeof layer.path !== 'string') throw new TypeError('Missing observation layer path.');
      try { await readGeometryPin(root, { path: layer.path }); } catch (error) { if (missing(error)) return false; throw error; }
    }
  }
  return true;
}
async function structuresReady(root: string, path: string) {
  try {
    const catalogue = readStructureCatalogue(JSON.parse(await readFile(resolve(root, path), 'utf8')));
    for (const image of catalogue.images) await readRegisteredGeometrySource(root, path, image.id);
    return true;
  } catch (error) { if (missing(error)) return false; throw error; }
}

/** Calls the existing source owners; success requires their artifact, never only process exit. */
export async function runCompilerSourceCommand(root: string, name: string, recipe: string, sentinel: string, signal: AbortSignal, progress: CompilerProgress) {
  signal.throwIfAborted();
  await new Promise<void>((accept, reject) => {
    const child = spawn(process.execPath, ['--experimental-strip-types', resolve(root, 'labs/nebula/run.mts'), name, recipe], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let seen = false, errors = '', buffer = '';
    const abort = () => child.kill('SIGTERM'); signal.addEventListener('abort', abort, { once: true });
    child.stdout.on('data', (data: Buffer) => {
      buffer += data.toString(); const lines = buffer.split('\n'); buffer = lines.pop()!;
      for (const line of lines) { if (line.includes(sentinel)) seen = true; if (line.trim()) progress(line.slice(0, 140)); }
    });
    child.stderr.on('data', (data: Buffer) => { errors = (errors + data.toString()).slice(-3000); });
    child.on('error', reject); child.on('close', code => { signal.removeEventListener('abort', abort);
      if (signal.aborted) reject(new DOMException('Compiler cancelled.', 'AbortError'));
      else if (code !== 0 || !seen) reject(new Error(errors || `${name} did not produce its completion receipt.`)); else accept(); });
  });
}
export async function restoreCompilerInputs(root: string, recipe: CompilerRecipe, signal: AbortSignal, progress: CompilerProgress): Promise<CompilerStep[]> {
  const steps: CompilerStep[] = []; let started = performance.now(), restored = false;
  progress('Checking registered images and native star separation…', .02);
  let prepared = await present(root, recipe.observationCatalogue);
  if (prepared) {
    const value: unknown = JSON.parse(await readFile(resolve(root, recipe.observationCatalogue), 'utf8'));
    prepared = await compilerLayersReady(root, value);
    if (jointRecord(value) && jointRecord(value.provenance)) prepared &&= value.provenance.recipeSha256 === geometrySha(await readFile(resolve(root, recipe.observationRecipe)));
  }
  if (!prepared) {
    await runCompilerSourceCommand(root, 'prepare-observations', recipe.observationRecipe, 'NEBULA_OBSERVATIONS_COMPLETE', signal, progress); restored = true;
  }
  if (!await compilerLayersReady(root, JSON.parse(await readFile(resolve(root, recipe.observationCatalogue), 'utf8'))))
    throw new Error('Observation preparation did not restore all original/starless/residual layers.');
  steps.push({ id: 'observations', label: 'Align + remove stars', state: restored ? 'complete' : 'reused', seconds: (performance.now() - started) / 1000 });
  started = performance.now(); progress('Checking structure evidence…', .12);
  const existing = await structuresReady(root, recipe.structureCatalogue);
  if (!existing || restored) await runCompilerSourceCommand(root, 'prepare-observation-structures', recipe.structureRecipe, 'OBSERVATION_STRUCTURES_COMPLETE', signal, progress);
  if (!await structuresReady(root, recipe.structureCatalogue)) throw new Error('Structure preparation did not restore every registered raster.');
  steps.push({ id: 'structures', label: 'Extract + combine structure', state: existing && !restored ? 'reused' : 'complete', seconds: (performance.now() - started) / 1000 });
  if (recipe.jointRecipe) {
    started = performance.now(); progress('Checking measured velocities…', .18);
    const joint = readJointRecipe(JSON.parse(await readFile(resolve(root, recipe.jointRecipe), 'utf8')));
    const acquired = await acquireMolecularSources(root, joint.molecularSource);
    steps.push({ id: 'velocities', label: 'Velocity constraints', state: acquired.sources.every(source => source.status === 'verified') ? 'reused' : 'complete', seconds: (performance.now() - started) / 1000 });
  }
  return steps;
}
