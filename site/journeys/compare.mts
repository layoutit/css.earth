/** CLI: compare one base recording with one head recording; 0 identical, 1 differences, 2 tool error. */
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { compareDirectories } from './harness/differ.mts';

export async function main(args: string[]): Promise<number> {
  const { values } = parseArgs({ args, options: { base: { type: 'string' }, head: { type: 'string' } } });
  if (!values.base || !values.head) throw new Error('Usage: node site/journeys/compare.mts --base <traceDir> --head <traceDir>');
  const differences = await compareDirectories(values.base, values.head);
  for (const difference of differences) console.log(JSON.stringify(difference));
  console.log(differences.length ? `DIFFERENT: ${differences.length} observations` : 'IDENTICAL: validated traces and screenshots');
  return differences.length ? 1 : 0;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.exitCode = await main(process.argv.slice(2)); }
  catch (error) { console.error(`TOOL ERROR: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 2; }
}
