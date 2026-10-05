/** Independent Node source bytes, compact hit summaries and qualification must survive the disk boundary. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { normalizeNode } from './collect-node.mts';
import { convert } from './convert.mts';
import { merge } from './merge.mts';
import { writeHitSummary, readHitSummary } from './hit-summary.mts';

test('normalization deduplicates paths and compares independently captured source bytes', () => {
  const tmp=fileURLToPath(new URL('../../../output/coverage/',import.meta.url));mkdirSync(tmp,{recursive:true});
  const root=mkdtempSync(resolve(tmp,'collector-'));
  try {
    for(const dir of ['raw','raw/captured','v8'])mkdirSync(resolve(root,dir),{recursive:true});
    const file=resolve(root,'a.mts'),url=pathToFileURL(file).href;
    writeFileSync(file,'run();');
    writeFileSync(resolve(root,'raw/captured/actual.js'),'old();');
    writeFileSync(resolve(root,'raw/captured/process.json'),JSON.stringify({[url]:'actual.js'}));
    const script={url,functions:[{functionName:'',isBlockCoverage:true,ranges:[{startOffset:0,endOffset:6,count:1}]}]};
    for(const name of ['one','two'])writeFileSync(resolve(root,`v8/${name}.json`),JSON.stringify({result:[script]}));
    const raw=normalizeNode(resolve(root,'v8'),resolve(root,'raw'),root);
    assert.equal(raw.scripts.length,1);assert.match(raw.scripts[0]!.context!,/2 snapshots/);
    assert.equal(readFileSync(resolve(root,'raw',raw.scripts[0]!.source),'utf8'),'old();');
    const evidence=convert(resolve(root,'raw'),root);
    assert.throws(()=>merge(root,['a.mts'],[evidence]), /Stale in-scope/);
    writeFileSync(file,'old();');
    const valid=convert(resolve(root,'raw'),root);
    writeHitSummary(resolve(root,'summary.json'),root,['a.mts'],valid,true);
    const restored=readHitSummary(resolve(root,'summary.json'),root,['a.mts']);
    assert.equal(merge(root,['a.mts'],[restored]).files[0]!.lines.hit,1);
    const summary=JSON.parse(readFileSync(resolve(root,'summary.json'),'utf8'));
    summary.files[0].hits=['forged'];writeFileSync(resolve(root,'summary.json'),JSON.stringify(summary));
    assert.throws(()=>readHitSummary(resolve(root,'summary.json'),root,['a.mts']), /Invalid hit/);
  } finally {rmSync(root,{recursive:true,force:true});}
});
test('Node path compaction unions resolved snapshot hits rather than nested raw counts', async () => {
  const {dedupeNodeScripts}=await import('./node-union.mts');
  const {directIntervals}=await import('./convert.mts');
  const tmp=fileURLToPath(new URL('../../../output/coverage/',import.meta.url));mkdirSync(tmp,{recursive:true});
  const root=mkdtempSync(resolve(tmp,'node-union-'));
  try {
    writeFileSync(resolve(root,'source.js'),'123456789');
    const record=(ranges:{startOffset:number;endOffset:number;count:number}[])=>({sourcePath:'a.mts',url:'file:///a.mts',source:'source.js',functions:[{functionName:'',isBlockCoverage:true,ranges}]});
    const first=record([{startOffset:0,endOffset:9,count:1},{startOffset:3,endOffset:6,count:0}]);
    const second=record([{startOffset:0,endOffset:9,count:0},{startOffset:3,endOffset:4,count:1}]);
    const compact=dedupeNodeScripts([first,second],root);
    assert.equal(compact.length,1);
    const intervals=directIntervals(compact[0]!.functions,9).intervals;
    assert.ok(intervals.some(r=>r.covered && r.start<=3 && r.end>=4));
    assert.ok(intervals.some(r=>!r.covered && r.start<=4 && r.end>=6));
  } finally {rmSync(root,{recursive:true,force:true});}
});
test('merge unions the hits of every run and divides once, so the aggregate is neither one run nor an average', () => {
  const tmp = fileURLToPath(new URL('../../../output/coverage/', import.meta.url)); mkdirSync(tmp, { recursive: true });
  const root = mkdtempSync(resolve(tmp, 'merge-union-'));
  try {
    writeFileSync(resolve(root, 'a.mts'), 'one();\ntwo();\nthree();\n');
    writeFileSync(resolve(root, 'b.mts'), 'four();\n');
    const interval = (length: number) => [{ start: 0, end: length, covered: true }];
    const evidence = (kind: string, rows: [string, number][]) => ({ kind, costMs: 0, qualified: true, unmapped: [], loaded: new Set(rows.map(([file]) => file)),
      files: new Map(rows.map(([file, length]) => [file, interval(length)] as const)) });
    const summary = merge(root, ['a.mts', 'b.mts'], [evidence('node', [['a.mts', 21]]), evidence('browser', [['b.mts', 8]])]);
    assert.deepEqual([summary.aggregate.lines.hit, summary.aggregate.lines.total], [4, 4], 'the union covers all four lines');
    assert.deepEqual([summary.sources['0:node']!.aggregate.lines.hit, summary.sources['0:node']!.aggregate.lines.total], [3, 4], 'one run alone covers three of four');
    assert.deepEqual([summary.sources['1:browser']!.aggregate.lines.hit, summary.sources['1:browser']!.aggregate.lines.total], [1, 4]);
    assert.equal(summary.aggregate.lines.pct, 100, 'an average of the two runs (62.5) is wrong');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
