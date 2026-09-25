import { defaultCompilerControls, readCompilerControls, type CompilerControls } from '@cssearth/bake/volume';
export { defaultCompilerControls, readCompilerControls, type CompilerControls } from '@cssearth/bake/volume';
import { readCompilerTargetControls, type CompilerTargetControls } from '@cssearth/nebula-reconstruction/methods/inference/target';
import type { Matrix } from '../observations/models/model.ts';
import { jointPath, jointRecord } from '../joint-fit/model.ts';
export const COMPILER_VERSION = 'registered-emission-compiler@1';
import {readCompilerStarCatalogue,type CompilerStarCatalogue} from '@cssearth/nebula-reconstruction/stars/catalogue-model';
export {readCompilerStarCatalogue,type CompilerStarCatalogue} from '@cssearth/nebula-reconstruction/stars/catalogue-model';
export interface CompilerEmissionWindow { sourceId: string; featherArcsec: number }
export interface ObservedStarCataloguePin { path: string }
export interface CompilerRequest { action: 'apply'; imageId: 'compiler'; recipePath: string; cataloguePath: string;
  imageToFrame: Record<string, Matrix>; evidence: { sensitivity: number; weights: number[] }; controls: CompilerControls }
export interface CompilerRecipe { schema: 'cssearth-nebula-compiler@1'; id: string; label: string; observationRecipe: string;
  observationCatalogue: string; structureRecipe: string; structureCatalogue: string; jointRecipe?: string; depthRecipe?: string; sampledRecipe?: string; photometricPriorRecipe?: string;
  defaultSourceId: string; maximumStars: number; interpretation: string;
  defaultControls?: CompilerControls; sourceWeights?: Record<string, number>; starCatalogue?: CompilerStarCatalogue; observedStars?: ObservedStarCataloguePin; targetControls?: CompilerTargetControls; emissionWindow?: CompilerEmissionWindow }
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const range = (v: unknown, low: number, high: number): v is number => finite(v) && v >= low && v <= high;
export function readCompilerRequest(v: unknown): CompilerRequest {
  if (!jointRecord(v) || v.action !== 'apply' || v.imageId !== 'compiler' || !jointPath(v.recipePath) || !v.recipePath.startsWith('labs/nebula/models/') ||
      !jointPath(v.cataloguePath) || !v.cataloguePath.startsWith('.local/nebula-lab/') || !jointRecord(v.imageToFrame) || !jointRecord(v.evidence) ||
      !range(v.evidence.sensitivity, .25, 4) || !Array.isArray(v.evidence.weights) || v.evidence.weights.length > 8 || !v.evidence.weights.every(n => range(n, 0, 2))) throw new TypeError('Invalid compiler request.');
  const imageToFrame: Record<string, Matrix> = {};
  for (const [key, matrix] of Object.entries(v.imageToFrame)) {
    if (!/^[a-z0-9-]+$/.test(key) || !Array.isArray(matrix) || matrix.length !== 6 || !matrix.every(finite) || Math.abs(matrix[0] * matrix[3] - matrix[1] * matrix[2]) < 1e-12) throw new TypeError('Invalid compiler image registration.');
    imageToFrame[key] = [matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]];
  }
  return { action: v.action, imageId: v.imageId, recipePath: v.recipePath, cataloguePath: v.cataloguePath, imageToFrame,
    evidence: { sensitivity: v.evidence.sensitivity, weights: [...v.evidence.weights] }, controls: readCompilerControls(v.controls) };
}
export function readCompilerRecipe(v: unknown): CompilerRecipe {
  if (!jointRecord(v) || v.schema !== 'cssearth-nebula-compiler@1' || typeof v.id !== 'string' || !/^[a-z0-9-]+$/.test(v.id) || typeof v.label !== 'string' ||
      !jointPath(v.observationRecipe) || !jointPath(v.observationCatalogue) || !jointPath(v.structureRecipe) || !jointPath(v.structureCatalogue) ||
      (v.jointRecipe !== undefined && !jointPath(v.jointRecipe)) || (v.depthRecipe !== undefined && (!jointPath(v.depthRecipe) || !v.depthRecipe.startsWith('labs/nebula/models/'))) ||
      (v.sampledRecipe !== undefined && (!jointPath(v.sampledRecipe) || !v.sampledRecipe.startsWith('labs/nebula/models/'))) ||
      (v.photometricPriorRecipe !== undefined && (!jointPath(v.photometricPriorRecipe) || !v.photometricPriorRecipe.startsWith('labs/nebula/models/'))) ||
      [v.jointRecipe, v.depthRecipe, v.sampledRecipe, v.photometricPriorRecipe].filter(value => value !== undefined).length > 1 || typeof v.defaultSourceId !== 'string' || !range(v.maximumStars, 0, 2000) || !Number.isInteger(v.maximumStars) || typeof v.interpretation !== 'string') throw new TypeError('Invalid compiler recipe.');
  const targetControls = v.targetControls === undefined ? undefined : readCompilerTargetControls(v.targetControls);
  const emissionWindow = v.emissionWindow === undefined ? undefined : readCompilerEmissionWindow(v.emissionWindow);
  if (emissionWindow && v.sampledRecipe !== undefined) throw new TypeError('Image emission windows require the emission-field route.');
  const controls = v.defaultControls === undefined ? undefined : readCompilerControls(v.defaultControls);
  if (v.photometricPriorRecipe && controls && controls.depth !== 1)
    throw new TypeError('Photometric prior controls require depth=1.');
  const starCatalogue = v.starCatalogue === undefined ? undefined : readCompilerStarCatalogue(v.starCatalogue);
  const observedStars = v.observedStars === undefined ? undefined : readObservedStarCataloguePin(v.observedStars);
  if (observedStars && (starCatalogue || v.sampledRecipe)) throw new TypeError('Choose one supported stellar catalogue route.');
  if (starCatalogue && (starCatalogue.sourceIds[0] !== v.defaultSourceId || v.sampledRecipe !== undefined))
    throw new TypeError('Compiler star catalogue must start with the reference source and use the emission-field route.');
  let sourceWeights: Record<string, number> | undefined;
  if (v.sourceWeights !== undefined) {
    if (!jointRecord(v.sourceWeights) || !Object.keys(v.sourceWeights).length || Object.keys(v.sourceWeights).length > 8 ||
        Object.entries(v.sourceWeights).some(([id, weight]) => !/^[a-z0-9][a-z0-9-]*$/.test(id) || !range(weight, 0, 2)))
      throw new TypeError('Invalid compiler source weights.');
    sourceWeights = Object.fromEntries(Object.entries(v.sourceWeights).map(([id, weight]) => [id, Number(weight)]));
  }
  return { schema: v.schema, id: v.id, label: v.label, observationRecipe: v.observationRecipe, observationCatalogue: v.observationCatalogue,
    structureRecipe: v.structureRecipe, structureCatalogue: v.structureCatalogue, jointRecipe: v.jointRecipe, ...(v.depthRecipe ? { depthRecipe: v.depthRecipe } : {}), ...(v.sampledRecipe ? { sampledRecipe: v.sampledRecipe } : {}),
    ...(v.photometricPriorRecipe ? { photometricPriorRecipe: v.photometricPriorRecipe } : {}), defaultSourceId: v.defaultSourceId,
    maximumStars: v.maximumStars, interpretation: v.interpretation,
    ...(controls ? { defaultControls: controls } : {}), ...(sourceWeights ? { sourceWeights } : {}), ...(starCatalogue ? { starCatalogue } : {}), ...(observedStars ? { observedStars } : {}), ...(targetControls ? { targetControls } : {}), ...(emissionWindow ? { emissionWindow } : {}) };
}
export function readCompilerEmissionWindow(v: unknown): CompilerEmissionWindow {
  if (!jointRecord(v) || Object.keys(v).some(key => !['sourceId', 'featherArcsec'].includes(key)) ||
      typeof v.sourceId !== 'string' || !/^[a-z0-9][a-z0-9-]{0,95}$/.test(v.sourceId) || !range(v.featherArcsec, 0, 3600))
    throw new TypeError('Invalid compiler emission window.');
  return { sourceId: v.sourceId, featherArcsec: v.featherArcsec };
}
export function readObservedStarCataloguePin(value: unknown): ObservedStarCataloguePin {
  if (!jointRecord(value) || !jointPath(value.path) || !value.path.startsWith('labs/nebula/models/')) throw new TypeError('Invalid observed stellar catalogue pin.');
  return { path: value.path };
}
/** Callers omit controls only when they have no saved or explicit user choice. */
export function compilerControlsForRecipe(recipe: CompilerRecipe, requested?: CompilerControls): CompilerControls {
  return readCompilerControls(requested ?? recipe.defaultControls ?? defaultCompilerControls);
}
/** IDs prevent catalogue reordering from transferring a source's authored weight to another lens. */
export function compilerSourceWeights(recipe: CompilerRecipe, sourceIds: string[], requested: number[] = []): number[] {
  if (!sourceIds.length || new Set(sourceIds).size !== sourceIds.length ||
      Object.keys(recipe.sourceWeights ?? {}).some(id => !sourceIds.includes(id)))
    throw new TypeError('Compiler source weights reference an unavailable image.');
  const weights = requested.length ? [...requested] : sourceIds.map(id => recipe.sourceWeights?.[id] ?? 1);
  if (weights.length !== sourceIds.length || weights.some(weight => !range(weight, 0, 2)) || !weights.some(weight => weight > 0))
    throw new TypeError('Enable at least one source image with valid compiler weights.');
  return weights;
}
