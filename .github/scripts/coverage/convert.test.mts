/** Hand-made evidence probes AST units, nested zero ranges, map segments and union identity. */
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SourceMapGenerator } from 'source-map-js';
import { sourceUnits } from './units.mts';
import { directIntervals, mapIntervals, inlineIntervals } from './convert.mts';
import { merge } from './merge.mts';
import { parseRaw, parseFunctions } from './raw.mts';
import type { Evidence } from './convert.mts';
import type { V8Function } from './raw.mts';

function fixture(run:(root:string)=>void) { const temp = fileURLToPath(new URL('../../../output/coverage/', import.meta.url)); mkdirSync(temp,{recursive:true});const root=mkdtempSync(resolve(temp,'fixture-'));try {run(root);}finally{rmSync(root,{recursive:true,force:true});} }
const whole=(source:string,count=1):V8Function[]=>[{functionName:'',isBlockCoverage:true,ranges:[{startOffset:0,endOffset:source.length,count}]}];
test('all source branch kinds have independent executable token units; erased constructs excluded',()=>{
  const source=`import type { A } from './a.mts';
import { type B } from './b.mts';
interface I { n: number }
type T = number;
declare const erased: number;
export function run(a = defaultValue()) {
  if (a) { yes(); } else { no(); }
  switch (a) { case 1: one(); break; default: other(); }
  try { work(); } catch (e) { recover(); } finally { tidy(); }
  a ? left() : right();
  a && and(); a || or(); a ?? nullish();
  for (let i=0;i<a;i++) { tick(); }
  for (const x of a) { item(x); }
  for (const x in a) { key(x); }
  while(a) { spin(); }
  do { once(); } while(a);
  a?.b; a?.(); a?.[0];
}
class C { field = init(); method() { return 1; } get value() { return 2; } set value(v) { use(v); } }
const arrow = () => answer();
const expression = function() { return 3; };
`;
  const {units,limits}=sourceUnits('tiny.mts',source), branches=units.filter(u=>u.kind==='branches');
  for(const label of ['if','else','case','default','catch','finally','ternary:true','ternary:false','&&','||','??']) assert.equal(branches.filter(u=>u.label===label).length,1,label);
  assert.equal(branches.filter(u=>u.label==='loop').length,5);
  assert.equal(units.filter(u=>u.kind==='functions').length,6);
  assert.equal(branches.filter(u=>u.label==='optional:continuation').length,3); assert.ok(limits.some(l=>l.includes('default initializer')));
  assert.ok(units.every(u=>u.line>5));
  assert.equal(new Set(units.filter(u=>u.kind==='lines').map(u=>u.line)).size,units.filter(u=>u.kind==='lines').length);
});
test('default-path uncovered branch is missed, then flips when range is covered',()=>fixture(root=>{
  const source='export function run() {\n  if (neverTrue()) {\n    missed();\n  } else {\n    hit();\n  }\n}\nrun();\n';
  writeFileSync(resolve(root,'tiny.mts'),source);
  const start=source.indexOf('missed'), end=start+'missed();'.length;
  const funcs=whole(source);funcs[0]!.ranges.push({startOffset:start,endOffset:end,count:0});
  const evidence=(functions:V8Function[]):Evidence=>({files:new Map([['tiny.mts',directIntervals(functions,source.length).intervals]]),loaded:new Set(['tiny.mts']),unmapped:[],kind:'node',costMs:0});
  const missed=merge(root,['tiny.mts'],[evidence(funcs)]);
  assert.deepEqual(missed.files[0]!.branches,{hit:1,total:2,pct:50});assert.ok(missed.files[0]!.missed.branches.some(u=>u.line===3 && u.label==='if' && u.column>0 && u.snippet.includes('missed')));
  funcs[0]!.ranges[1]!.count=1;
  assert.equal(merge(root,['tiny.mts'],[evidence(funcs)]).files[0]!.branches.pct,100);
}));
test('nested function zero dominates root hit, narrower nested hit dominates zero, equal conflicting ranges ambiguous',()=>{
  const funcs=whole(' '.repeat(100)); funcs.push({functionName:'f',isBlockCoverage:true,ranges:[{startOffset:10,endOffset:90,count:0},{startOffset:20,endOffset:30,count:1}]});
  const result=directIntervals(funcs,100);
  assert.deepEqual(result.intervals.map(r=>[r.start,r.end,r.covered]),[[0,10,true],[10,20,false],[20,30,true],[30,90,false],[90,100,true]]);
  const ambiguous=directIntervals([...whole('abc'),...whole('abc',0)],3);assert.equal(ambiguous.ambiguous,1);assert.equal(ambiguous.intervals.length,0);
  assert.throws(()=>directIntervals(funcs,50));
});
test('minified map with several sources and sourcesContent preserves covered and uncovered segments',()=>fixture(root=>{
  mkdirSync(resolve(root,'site'));const a='hit();\nmiss();\n',b='other();\n';
  writeFileSync(resolve(root,'site/a.mts'),a);writeFileSync(resolve(root,'site/b.mts'),b);
  const generated='h();m();o();',map=new SourceMapGenerator();
  map.addMapping({generated:{line:1,column:0},original:{line:1,column:0},source:'../../site/a.mts'});
  map.addMapping({generated:{line:1,column:4},original:{line:2,column:0},source:'../../site/a.mts'});
  map.addMapping({generated:{line:1,column:8},original:{line:1,column:0},source:'../../site/b.mts'});
  map.setSourceContent('../../site/a.mts',a);map.setSourceContent('../../site/b.mts',b);
  const f=whole(generated);f[0]!.ranges.push({startOffset:4,endOffset:8,count:0});
  const result=mapIntervals(generated,f,JSON.parse(map.toString()),resolve(root,'dist/_astro/chunk.js'),root);
  assert.deepEqual(result.files.get('site/a.mts')!.map(r=>r.covered),[true,false]);assert.equal(result.files.get('site/b.mts')![0]!.covered,true);
  const rawMap=JSON.parse(map.toString()); rawMap.sourcesContent[0]='stale';
  const stale=mapIntervals(generated,f,rawMap,resolve(root,'dist/_astro/chunk.js'),root);assert.ok([...stale.issues.keys()].some(r=>r.includes('stale')));assert.equal(stale.files.has('site/a.mts'),false);
}));
test('unmapped prefixes and absent V8 ranges are visible; map gaps cannot cover omitted source statements',()=>fixture(root=>{
  const s='first();\ndead();\nlast();\n';writeFileSync(resolve(root,'a.mts'),s);const map=new SourceMapGenerator();
  map.addMapping({generated:{line:1,column:2},original:{line:1,column:0},source:'a.mts'});
  map.addMapping({generated:{line:1,column:6},original:{line:3,column:0},source:'a.mts'});map.setSourceContent('a.mts',s);
  const result=mapIntervals('xxf();l();',whole('xxf();l();'),JSON.parse(map.toString()),resolve(root,'bundle.js'),root);
  assert.ok(result.issues.has('generated prefix without source mapping'));
  assert.ok(result.files.get('a.mts')!.every(r=>r.end<=s.indexOf('dead') || r.start>=s.indexOf('last')));
  const absent=mapIntervals('xxf();l();',[],JSON.parse(map.toString()),resolve(root,'bundle.js'),root);assert.ok(absent.issues.has('segment without V8 evidence'));
}));
test('never loaded keeps AST denominator; hit union is monotone and does not average',()=>fixture(root=>{
  const s='first();\nsecond();\n';writeFileSync(resolve(root,'a.mts'),s);writeFileSync(resolve(root,'never.mts'),'unused();\n');
  const e=(start:number,end:number,kind:string):Evidence=>({files:new Map([['a.mts',[{start,end,covered:true}]]]),loaded:new Set(['a.mts']),unmapped:[],kind,costMs:1});
  const node=e(0,5,'node'),browser=e(9,15,'browser'),summary=merge(root,['a.mts','never.mts'],[node,browser]);
  assert.equal(summary.files[0]!.lines.hit,2);assert.equal(summary.sources['0:node']!.files[0]!.lines.hit,1);assert.equal(summary.sources['1:browser']!.files[0]!.lines.hit,1);
  assert.deepEqual(summary.files[1]!.lines,{hit:0,total:1,pct:0});assert.deepEqual(summary.neverLoaded,['never.mts']);
}));
test('external raw schema rejects invalid paths, counts, versions and ranges',()=>{
  assert.throws(()=>parseRaw({version:2}));assert.throws(()=>parseFunctions([{functionName:'',isBlockCoverage:true,ranges:[{startOffset:5,endOffset:3,count:0}]}]));
  const raw={version:1,kind:'node',root:resolve('.'),costMs:1,issues:[],scripts:[{url:'x',source:'../escape',functions:whole('abc')}]};assert.throws(()=>parseRaw(raw));
  raw.scripts[0]!.source='x.js';assert.equal(parseRaw(raw).scripts.length,1);
});
test('old browser source identity maps through a move to unchanged new source, cycles reject', { timeout: 5000 }, ()=>fixture(root=>{
  mkdirSync(resolve(root,'site')); const source='run();\n';writeFileSync(resolve(root,'site/new.mts'),source);
  const map=new SourceMapGenerator();map.addMapping({generated:{line:1,column:0},original:{line:1,column:0},source:'../../site/old.mts'});map.setSourceContent('../../site/old.mts',source);
  const result=mapIntervals('r();',whole('r();'),JSON.parse(map.toString()),resolve(root,'dist/_astro/a.js'),root,{'site/old.mts':'site/new.mts'});
  assert.ok(result.files.has('site/new.mts'));assert.equal(result.files.has('site/old.mts'),false);

}));
test('value imports and exports execute; type-only exports and bodyless declarations do not',()=>{
  const s="import { value } from './x.mts';\nexport { value };\nexport type { T } from './x.mts';\nexport { type U } from './x.mts';\ndeclare function erased(): void;\n";
  assert.deepEqual(sourceUnits('tiny.mts',s).units.filter(u=>u.kind==='lines').map(u=>u.line),[1,2]);
});
test('each variable declarator, class field and implicit enum member contributes its own runtime line',()=>{
  const source='const a=run(),\n b=second();\nclass Example {\n field;\n declare erased: number;\n}\nenum E {\n A,\n B\n}\nabstract class Abstract {\n abstract noRuntime: number;\n}\n';
  assert.deepEqual(sourceUnits('tiny.mts',source).units.filter(u=>u.kind==='lines').map(u=>u.line),[1,2,3,4,7,8,9,11]);
});
test('maps lacking original bytes cannot attest repository or foreign-checkout source identity',()=>fixture(root=>{
  writeFileSync(resolve(root,'a.mts'),'current();\n');const map=new SourceMapGenerator();map.addMapping({generated:{line:1,column:0},original:{line:1,column:0},source:'a.mts'});
  const result=mapIntervals('old();',whole('old();'),JSON.parse(map.toString()),resolve(root,'bundle.js'),root);
  assert.equal(result.files.size,0);assert.ok(result.issues.has('missing sourcesContent: a.mts'));
}));
test('trivia source-map points never extend into the following executable statement',()=>fixture(root=>{
  const source='/* comment */\nmissed();\n';writeFileSync(resolve(root,'a.mts'),source);const map=new SourceMapGenerator();map.addMapping({generated:{line:1,column:0},original:{line:1,column:0},source:'a.mts'});map.setSourceContent('a.mts',source);
  const result=mapIntervals('x();',whole('x();'),JSON.parse(map.toString()),resolve(root,'bundle.js'),root);
  assert.equal(result.files.size,0);assert.ok(result.issues.has('segment points at original trivia'));
}));
test('outer function entry stays hit when its first declaration is an uncalled inner function',()=>fixture(root=>{
  const source='function outer() { function inner() { return 9; } return 1; }\nouter();\n';writeFileSync(resolve(root,'a.mts'),source);
  const functions=whole(source);functions.push({functionName:'inner',isBlockCoverage:false,ranges:[{startOffset:source.indexOf('function inner'),endOffset:source.indexOf(' return 1;'),count:0}]});
  const evidence:Evidence={files:new Map([['a.mts',directIntervals(functions,source.length).intervals]]),loaded:new Set(['a.mts']),unmapped:[],kind:'node',costMs:0};
  assert.equal(merge(root,['a.mts'],[evidence]).files[0]!.functions.hit,1);
}));
test('default initializers are limits, never unreachable denominator units', () => {
  const result = sourceUnits('a.mts', 'function f(a=init()) { return a; }\nf(2);\n');
  assert.equal(result.units.filter(u => u.kind === 'branches').length, 0);
  assert.ok(result.limits.some(l => l.includes('default initializer')));
});
test('a bundled function signature proves entry even when its opening brace has no mapping',()=>fixture(root=>{
  const source='function outer() { function inner() { return 9; } return 1; }\nouter();\n';writeFileSync(resolve(root,'a.mts'),source);
  const generated='function o(){function i(){return 9}return 1}o();', map=new SourceMapGenerator();
  for(const [generatedColumn,originalColumn] of [[generated.indexOf('o()'),source.indexOf('outer()')],[generated.indexOf('i()'),source.indexOf('inner()')],[generated.indexOf('return 1'),source.indexOf('return 1')]]) map.addMapping({generated:{line:1,column:generatedColumn!},original:{line:1,column:originalColumn!},source:'a.mts'});
  map.setSourceContent('a.mts',source);const functions=whole(generated);functions.push({functionName:'i',isBlockCoverage:false,ranges:[{startOffset:generated.indexOf('function i'),endOffset:generated.indexOf('return 1'),count:0}]});
  const converted=mapIntervals(generated,functions,JSON.parse(map.toString()),resolve(root,'bundle.js'),root), evidence:Evidence={files:converted.files,loaded:converted.loaded,unmapped:[],kind:'browser',costMs:0};
  assert.equal(merge(root,['a.mts'],[evidence]).files[0]!.functions.hit,1);
}));
test('a column past the declared original line cannot reach the next statement',()=>fixture(root=>{
  const source='first();\nmissed();\n';writeFileSync(resolve(root,'a.mts'),source);const map=new SourceMapGenerator();
  map.addMapping({generated:{line:1,column:0},original:{line:1,column:9},source:'a.mts'});map.setSourceContent('a.mts',source);
  assert.throws(()=>mapIntervals('x();',whole('x();'),JSON.parse(map.toString()),resolve(root,'bundle.js'),root),/column exceeds line/u);
}));

test('inline exact matching translates positions and rejects duplicate text', () => fixture(root => {
  const exact = 'function bootstrap(a) { return a?.x; }';
  const original = `export ${exact}\n`;
  const source = `(${exact})(null);`;
  const functions = whole(source);
  functions[0]!.ranges.push({startOffset:source.indexOf('?.'),endOffset:source.indexOf('?.')+3,count:0});
  const mapped = inlineIntervals(source,functions,new Map([['a.mts',original]]));
  writeFileSync(resolve(root,'a.mts'),original);
  const summary=merge(root,['a.mts'],[{...mapped,unmapped:[],kind:'browser',costMs:0}]);
  assert.equal(summary.files[0]!.branches.hit,0);
  assert.equal(summary.files[0]!.functions.hit,1);
  assert.ok(inlineIntervals(source,functions,new Map([['a.mts',original+original]])).issues.some(i=>i.includes('duplicate')));
  assert.equal(inlineIntervals(source,functions,new Map([['a.mts',original.replace('return','return  ') ]])).files.size,0);
}));
test('stale in-scope sources fail the report; Astro virtual modules are distinct diagnostics', () => fixture(root => {
  writeFileSync(resolve(root,'a.mts'),'current();');
  const evidence:Evidence={files:new Map(),loaded:new Set(),unmapped:[{script:'bundle',reason:'stale sourcesContent: a.mts',count:1}],kind:'browser',costMs:0};
  assert.throws(()=>merge(root,['a.mts'],[evidence]), /Stale in-scope/);
  const map=new SourceMapGenerator();writeFileSync(resolve(root,'a.astro'),'<script>work();</script>');
  map.addMapping({generated:{line:1,column:0},original:{line:1,column:0},source:'a.astro?astro&type=script'});
  map.setSourceContent('a.astro?astro&type=script','work();');
  const mapped=mapIntervals('work();',whole('work();'),JSON.parse(map.toString()),resolve(root,'bundle.js'),root);
  assert.ok([...mapped.issues.keys()].some(i=>i.startsWith('Astro virtual module')));
  assert.ok(![...mapped.issues.keys()].some(i=>i.startsWith('stale')));
}));

test('converter move cycles fail fast in an isolated process', { timeout: 5000 }, () => {
  const script=`import {movedPath} from ${JSON.stringify(new URL('./convert.mts',import.meta.url).href)};try{movedPath('a', {a:'b',b:'a'});process.exitCode=1;}catch(error){if(!/cyclic/i.test(error.message))throw error;console.log('CYCLE REJECTED');}`;
  const result=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',timeout:4000});
  assert.equal(result.status,0,`Cycle failed to terminate: ${result.error}`);
  assert.match(result.stdout,/CYCLE REJECTED/);
});
