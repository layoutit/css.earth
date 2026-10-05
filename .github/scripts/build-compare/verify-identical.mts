/** Strict report identity; telemetry is saved separately by the lane, never stripped here. */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { args, isMain, record, string } from './records.mts';
export const identityReports = ['report.json', 'server-answers.json', 'performance.json', 'comparison.md', 'performance/comparison.json', 'performance/comparison.md'];
export async function verifyIdentical(cached: string, fresh: string): Promise<void> {
  const cache = record(JSON.parse(await readFile(join(cached, 'cache.json'), 'utf8'))), forced = record(JSON.parse(await readFile(join(fresh, 'cache.json'), 'utf8')));
  if (cache.cachedBase !== true || forced.cachedBase !== false || string(forced.notice) !== 'forced fresh: no-base-cache') throw new Error('Identity proof requires a verified cache hit and a forced fresh base');
  const left = record(JSON.parse(await readFile(join(cached, 'inputs.json'), 'utf8'))), right = record(JSON.parse(await readFile(join(fresh, 'inputs.json'), 'utf8')));
  for (const field of ['base', 'head', 'mode', 'tools']) if (string(left[field]) !== string(right[field])) throw new Error(`Different PR inputs: ${field}`);
  for (const path of identityReports) {
    const [a, b] = await Promise.all([readFile(join(cached, path)), readFile(join(fresh, path))]);
    if (!a.equals(b)) throw new Error(`Report differs: ${path}`);
  }
  console.log('REPORT IDENTITY PASS: every report and comparison Markdown byte matches');
}
if (isMain(import.meta.url)) {
  const flags = args(['--cached', '--fresh']);
  if (!flags.get('--cached') || !flags.get('--fresh')) throw new Error('Required: --cached <reports> --fresh <reports>');
  await verifyIdentical(flags.get('--cached')!, flags.get('--fresh')!);
}
