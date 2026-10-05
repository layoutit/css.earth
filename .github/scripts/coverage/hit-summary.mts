/** Compact CI hand-off: original source identity plus per-file hit unit sets, never raw V8 dumps. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { object, list, text, repoPath, number } from './raw.mts';
import { sourceUnits } from './units.mts';
import { covered } from './merge.mts';
import type { Evidence } from './convert.mts';

export function writeHitSummary(out: string, root: string, scope: string[], evidence: Evidence, qualified: boolean): void {
  const files = scope.map(file => {
    const source = readFileSync(resolve(root,file),'utf8');
    return { file, source, loaded: evidence.loaded.has(file), hits: sourceUnits(file,source).units.filter(unit=>covered(unit,evidence,file)).map(unit=>unit.id) };
  });
  writeFileSync(out,JSON.stringify({version:1,kind:evidence.kind,qualified,costMs:evidence.costMs,files,unmapped:evidence.unmapped})+'\n');
}
export function readHitSummary(input: string, root: string, scope: string[]): Evidence {
  const value = object(JSON.parse(readFileSync(input,'utf8')));
  if (value.version !== 1 || typeof value.qualified !== 'boolean') throw new Error('Invalid hit summary');
  const hits = new Map<string,Set<string>>(), loaded = new Set<string>();
  for (const item of list(value.files)) {
    const row = object(item), file = repoPath(row.file), source = text(row.source);
    if (hits.has(file)) throw new Error('Duplicate hit summary file');
    if (source !== readFileSync(resolve(root,file),'utf8')) throw new Error(`Stale hit summary source: ${file}`);
    if (typeof row.loaded !== 'boolean') throw new Error('Invalid loaded flag');
    const allowed = new Set(sourceUnits(file,source).units.map(u=>u.id));
    const ids = list(row.hits).map(text);
    if (ids.some(id=>!allowed.has(id)) || new Set(ids).size !== ids.length) throw new Error('Invalid hit units');
    hits.set(file,new Set(ids)); if (row.loaded) loaded.add(file);
  }
  if (scope.length !== hits.size || scope.some(file=>!hits.has(file))) throw new Error('Hit summary scope differs');
  const unmapped = list(value.unmapped).map(item=>{const row=object(item);return {script:text(row.script),reason:text(row.reason),count:number(row.count)};});
  return { files:new Map(),hits,loaded,unmapped,kind:text(value.kind),costMs:number(value.costMs),qualified:value.qualified };
}
