export interface CompilerControls { detail: number; faint: number; depth: number }
export const defaultCompilerControls: CompilerControls = { detail: .65, faint: .35, depth: 1 };
const jointRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const range = (v: unknown, low: number, high: number): v is number => finite(v) && v >= low && v <= high;
export function readCompilerControls(v: unknown): CompilerControls {
  if (!jointRecord(v) || !range(v.detail, 0, 1) || !range(v.faint, 0, 1) || !range(v.depth, .5, 2)) throw new TypeError('Invalid compiler controls.');
  return { detail: v.detail, faint: v.faint, depth: v.depth };
}
