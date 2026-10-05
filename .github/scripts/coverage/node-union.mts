/** Collapse duplicate Node path records by unioning per-snapshot evidence before making V8-shaped ranges. */
import { readFileSync } from 'node:fs';
import { localFile } from './raw.mts';
import type { RawScript } from './raw.mts';
import { directIntervals } from './convert.mts';

export function dedupeNodeScripts(scripts: RawScript[], dir: string): RawScript[] {
  const groups = new Map<string,RawScript[]>();
  for (const script of scripts) {
    if (!script.sourcePath) throw new Error('Node snapshot has no path');
    const group=groups.get(script.sourcePath) ?? []; group.push(script); groups.set(script.sourcePath,group);
  }
  return [...groups.values()].map(group=>{
    const first=group[0]!, length=readFileSync(localFile(dir,first.source),'utf8').length;
    const positive=group.flatMap(script=>directIntervals(script.functions,length).intervals.filter(r=>r.covered)).sort((a,b)=>a.start-b.start);
    const merged: {start:number;end:number}[]=[];
    for (const interval of positive) {
      const last=merged.at(-1);
      if (last && interval.start<=last.end) last.end=Math.max(last.end,interval.end);
      else merged.push({start:interval.start,end:interval.end});
    }
    const whole=merged.length===1 && merged[0]!.start===0 && merged[0]!.end===length;
    return {...first,context:`node-path-union:${group.length} snapshots`,functions:[{
      functionName:'<snapshot union>',isBlockCoverage:true,ranges:[
        {startOffset:0,endOffset:length,count:whole?1:0},
        ...(!whole?merged.map(r=>({startOffset:r.start,endOffset:r.end,count:1})):[]),
      ],
    }]};
  });
}
