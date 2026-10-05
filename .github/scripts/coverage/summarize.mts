/** Convert and validate in the collection job; export compact source unit hits for the CI merge job. */
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { convert } from './convert.mts';
import { scopeFiles } from './report.mts';
import { merge } from './merge.mts';
import { writeHitSummary } from './hit-summary.mts';
import { validateRawDirectory } from './validate.mts';

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({ options: {
    root: { type: 'string', default: fileURLToPath(new URL('../../../',import.meta.url)) },
    scope: { type: 'string', default: 'root' }, raw: { type: 'string' }, out: { type: 'string' },
  } });
  if (!values.raw || !values.out) throw new Error('--raw and --out required');
  const root=resolve(values.root), scope=scopeFiles(root,values.scope), dir=resolve(root,values.raw);
  validateRawDirectory(dir);
  const evidence=convert(dir,root,{},scope);
  merge(root,scope,[evidence],[],values.scope); // Reject stale in-scope content before the hand-off.
  if (!evidence.qualified) throw new Error('Unqualified collection');
  writeHitSummary(resolve(root,values.out),root,scope,evidence,true);
  console.log(`Wrote ${scope.length} file hit sets: ${values.out}`);
}
