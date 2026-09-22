import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireRecord, requireArray, requireString, requireFiniteNumber } from '../../sources/source-values.mts';
import { ORACLE_ROOT } from '../fixture.mts';

export const orientations = ['identity', 'flip-x', 'flip-y', 'rotate-90', 'rotate-180', 'rotate-270'] as const;
export const queryFractions = [-.25,0,.125,.25,.375,.5,.625,.75,.875,1,1.25];
export function queryGrid() { return queryFractions.flatMap(y=>queryFractions.map(x=>[x,y])); }
export function assertQueryCoverage(values: unknown, behind = false) {
  const probes=requireArray(values), grid=queryGrid();
  if(probes.length!==grid.length+(behind?1:0))throw new Error('Incomplete SBMT query coverage');
  for(let i=0;i<grid.length;i++){
    const p=requireRecord(probes[i]), fraction=vector(p.fraction,2);
    if(fraction.some((v,j)=>v!==grid[i][j]))throw new Error('Missing, duplicate or reordered SBMT probe');
  }
  if(behind&&requireRecord(probes.at(-1)).depth!==-1)throw new Error('Missing behind-camera case');
  return probes.map(p=>requireRecord(p));
}
export function vector(value: unknown, length = 3): number[] {
  const result = requireArray(value).map(v => requireFiniteNumber(v));
  if (result.length !== length) throw new Error(`Expected ${length} coordinates`);
  return result;
}
export function count(value: unknown): number {
  const number = typeof value === 'bigint' ? Number(value) : requireFiniteNumber(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error('Invalid count');
  return number;
}
function sourcePath(value: unknown) {
  const path = requireString(value);
  if (!/^(src\/objects\/[a-z0-9-]+\/source\/|tests\/fixtures\/(sbmt|fits)\/)/.test(path) || path.includes('..') || path.includes('\\')) throw new Error('Invalid oracle source path');
  return path;
}
export function parseCase(value: unknown) {
  const c = requireRecord(value);
  for (const key of Object.keys(c)) if (!['id','shape','pointing','format','image','width','height','vertices','faces'].includes(key)) throw new Error(`Unsupported SBMT case option: ${key}`);
  const id = requireString(c.id);
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error('Invalid case id');
  if (c.format !== 'sum' && c.format !== 'info') throw new Error('Supported pointing formats: sum, info');
  const width = count(c.width), height = count(c.height), vertices = count(c.vertices), faces = count(c.faces);
  if (width < 2 || height < 2 || width * height > 4_194_304 || vertices < 4 || faces < 4 || faces > 250_000) throw new Error('Case exceeds the supported dimensions or bounded mesh budget');
  return { id, shape: sourcePath(c.shape), pointing: sourcePath(c.pointing), image: sourcePath(c.image), format: c.format,
    width, height, vertices, faces };
}
export async function cases() {
  const result = requireArray(JSON.parse(await readFile(resolve(ORACLE_ROOT, 'tests/fixtures/sbmt/cases.json'), 'utf8'))).map(parseCase);
  if (new Set(result.map(c => c.id)).size !== result.length) throw new Error('Duplicate SBMT case identity');
  return result;
}
export type Case = ReturnType<typeof parseCase>;
