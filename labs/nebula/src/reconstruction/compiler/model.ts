import type { Matrix } from '../../alignment/observations-ui/model';
import { jointPath, jointRecord } from '../joint-fit/model';
export const COMPILER_VERSION = 'registered-emission-compiler@1';
export interface CompilerControls { detail: number; faint: number; depth: number }
export const defaultCompilerControls: CompilerControls = { detail: .65, faint: .35, depth: 1 };
export interface CompilerRequest { action: 'apply'; imageId: 'compiler'; recipePath: string; cataloguePath: string;
  imageToFrame: Record<string, Matrix>; evidence: { sensitivity: number; weights: number[] }; controls: CompilerControls }
export interface CompilerRecipe { schema: 'cssearth-nebula-compiler@1'; id: string; label: string; observationRecipe: string;
  observationCatalogue: string; structureRecipe: string; structureCatalogue: string; jointRecipe?: string;
  defaultSourceId: string; maximumStars: number; interpretation: string }
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const range = (v: unknown, low: number, high: number): v is number => finite(v) && v >= low && v <= high;
export function readCompilerControls(v: unknown): CompilerControls {
  if (!jointRecord(v) || !range(v.detail, 0, 1) || !range(v.faint, 0, 1) || !range(v.depth, .5, 2)) throw new TypeError('Invalid compiler controls.');
  return { detail: v.detail, faint: v.faint, depth: v.depth };
}
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
      (v.jointRecipe !== undefined && !jointPath(v.jointRecipe)) || typeof v.defaultSourceId !== 'string' || !range(v.maximumStars, 0, 2000) || !Number.isInteger(v.maximumStars) || typeof v.interpretation !== 'string') throw new TypeError('Invalid compiler recipe.');
  return { schema: v.schema, id: v.id, label: v.label, observationRecipe: v.observationRecipe, observationCatalogue: v.observationCatalogue,
    structureRecipe: v.structureRecipe, structureCatalogue: v.structureCatalogue, jointRecipe: v.jointRecipe, defaultSourceId: v.defaultSourceId,
    maximumStars: v.maximumStars, interpretation: v.interpretation };
}
