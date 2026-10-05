/** Validate a raw directory's versioned manifest, referenced bytes, V8 offsets and source-map fields. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readRaw, localFile, object, list, text } from './raw.mts';
import { directIntervals, parseMap } from './convert.mts';
export function validateRawDirectory(dir:string):number {
  const raw=readRaw(dir);if(!raw.scripts.length) throw new Error('Empty evidence');
  for(const script of raw.scripts) {
    const source=readFileSync(localFile(dir,script.source),'utf8');directIntervals(script.functions,source.length);
    if(script.map) {if(!script.mapBase) throw new Error('Map lacks base');parseMap(JSON.parse(readFileSync(localFile(dir,script.map),'utf8')));}
  }
  if (raw.kind === 'browser') {
    const audit = object(JSON.parse(readFileSync(resolve(dir,'collection.json'),'utf8')));
    const navigation = list(audit.navigation).map(text), steps = list(audit.navigationSteps).map(object);
    if (!navigation.length || steps.length !== navigation.length) throw new Error('Missing navigation audit');
    for (const [index, step] of steps.entries()) {
      if (step.step !== index + 1 || step.url !== navigation[index] || typeof step.workersExpected !== 'boolean') throw new Error('Invalid navigation audit');
      const snapshots = raw.scripts.filter(s => s.context?.endsWith(`:navigation-${index + 1}`));
      if (!snapshots.some(s=>s.context?.startsWith('page:'))) throw new Error(`Missing snapshot for navigation ${index + 1}`);
      if (step.workersExpected && !snapshots.some(s=>s.context?.startsWith('worker:'))) throw new Error(`Missing worker snapshot for navigation ${index + 1}`);
    }
  }
  return raw.scripts.length;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  if(process.argv.length!==3) throw new Error('Usage: node validate.mts <raw directory>');console.log(`Validated ${validateRawDirectory(resolve(process.argv[2]!))} script snapshots`);
}
