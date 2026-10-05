/** Union stable AST unit identities; percentages are calculated after union, never averaged. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sourceUnits } from './units.mts';
import type { UnitKind, Unit } from './units.mts';
import type { Evidence } from './convert.mts';

export interface Metric { hit:number; total:number; pct:number }
export interface Row { file:string; exempt:boolean; loaded:boolean; lines:Metric; branches:Metric; functions:Metric; missed:Record<UnitKind,{line:number;column:number;label:string;snippet:string}[]>; limits:string[] }
export interface Summary { version:1; qualified:boolean; scopeId:string; scope:string[]; files:Row[]; aggregate:Record<UnitKind,Metric>; sources:Record<string,{aggregate:Record<UnitKind,Metric>;files:Row[];costMs:number}>; unmapped:Evidence['unmapped']; neverLoaded:string[]; targets:{pass:boolean; aggregateLines:boolean;aggregateBranches:boolean;below85:string[]}; exemptions:string[] }
const kinds:UnitKind[]=['lines','branches','functions'];
export const metric=(hit:number,total:number):Metric=>({hit,total,pct:total?100*hit/total:100});
const distinct=(unit:Unit,r:{rangeStart?:number;rangeEnd?:number})=>!unit.requiresOwnRange || (r.rangeStart!==undefined && r.rangeEnd!==undefined && r.rangeStart>=unit.requiresOwnRange.start && r.rangeEnd<=unit.requiresOwnRange.end);
export const covered=(unit:Unit,evidence:Evidence,file:string):boolean=>evidence.hits ? evidence.hits.get(file)?.has(unit.id) === true : (evidence.files.get(file)??[]).some(r=>r.covered && r.start<unit.end && r.end>unit.start && distinct(unit,r));
export function merge(root:string,scope:string[],runs:Evidence[],exemptions:string[]=[],scopeId="root"):Summary {
  const stale = runs.flatMap(r=>r.unmapped).filter(issue=>scope.some(file=>issue.reason === `stale sourcesContent: ${file}` || issue.reason === `Direct source differs from repository: ${file}`));
  if (stale.length) throw new Error(`Stale in-scope build evidence: ${stale.map(i=>i.reason).join('; ')}`);
  if(new Set(scope).size!==scope.length) throw new Error('Duplicate scope file');
  for(const file of exemptions) if(!scope.includes(file)) throw new Error(`Exemption outside scope: ${file}`);
  const definitions=scope.map(file=>({file,...sourceUnits(file,readFileSync(resolve(root,file),'utf8'))}));
  const rows=(selected:Evidence[]):Row[]=>definitions.map(d=>{
    const counts=(kind:UnitKind)=>{const units=d.units.filter(u=>u.kind===kind);return metric(units.filter(u=>selected.some(r=>covered(u,r,d.file))).length,units.length);};
    return {file:d.file,exempt:exemptions.includes(d.file),loaded:selected.some(r=>r.loaded.has(d.file)),lines:counts('lines'),branches:counts('branches'),functions:counts('functions'),
      missed:{lines:[],branches:[],functions:[],...Object.fromEntries(kinds.map(kind=>[kind,d.units.filter(u=>u.kind===kind && !selected.some(r=>covered(u,r,d.file))).map(u=>({line:u.line,column:u.column,label:u.label,snippet:u.snippet}))]))},limits:d.limits};
  });
  const aggregate=(files:Row[]):Record<UnitKind,Metric>=>({lines:sum(files,'lines'),branches:sum(files,'branches'),functions:sum(files,'functions')});
  function sum(files:Row[],kind:UnitKind):Metric { const eligible=files.filter(f=>!f.exempt);return metric(eligible.reduce((s,f)=>s+f[kind].hit,0),eligible.reduce((s,f)=>s+f[kind].total,0)); }
  const files=rows(runs), total=aggregate(files), sources:Summary['sources']={};
  runs.forEach((r,i)=>{ const rs=rows([r]); sources[`${i}:${r.kind}`]={aggregate:aggregate(rs),files:rs,costMs:r.costMs}; });
  const indistinguishable=definitions.flatMap(d=>d.units.filter(u=>u.requiresOwnRange && runs.some(r=>r.loaded.has(d.file)) && !runs.some(r=>(r.files.get(d.file)??[]).some(interval=>interval.start<u.end && interval.end>u.start && distinct(u,interval)))).map(u=>({script:d.file,reason:`line ${u.line}: default initializer has no distinct V8 range`,count:1})));
  const below85=files.filter(f=>!f.exempt && f.lines.pct<85).map(f=>f.file);
  return {version:1,qualified:runs.every(r=>r.qualified===true),scopeId,scope,files,aggregate:total,sources,unmapped:[...runs.flatMap(r=>r.unmapped),...indistinguishable],neverLoaded:files.filter(f=>!f.loaded).map(f=>f.file),targets:{pass:total.lines.pct>=90 && total.branches.pct>=85 && below85.length===0,aggregateLines:total.lines.pct>=90,aggregateBranches:total.branches.pct>=85,below85},exemptions};
}
