/** Verify that a rebuilt source comparison reaches every specified observation family. */
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify, parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const exec = promisify(execFile), families = ['network', 'dom', 'rendering', 'content', 'errors'];
export function expected(input: unknown): string[] {
  if (!input || typeof input !== 'object' || !('schema' in input) || input.schema !== 'journey-breakage@1'
    || !('expectedFamilies' in input) || !Array.isArray(input.expectedFamilies) || !input.expectedFamilies.length)
    throw new Error('Invalid breakage family contract');
  return input.expectedFamilies.map((value: unknown) => {
    if (typeof value !== 'string' || !families.includes(value)) throw new Error('Invalid expected family');
    return value;
  });
}
export function checkFamilies(required: readonly string[], output: string) {
  const actual = new Set<string>();
  for (const line of output.split('\n').filter(line => line.startsWith('{'))) {
    const input: unknown = JSON.parse(line);
    if (!input || typeof input !== 'object' || !('family' in input) || typeof input.family !== 'string'
      || ![...families, 'trace'].includes(input.family)) throw new Error('Malformed differ output');
    actual.add(input.family);
  }
  for (const family of required) if (!actual.has(family)) throw new Error(`Expected breakage family missing: ${family}`);
  return [...actual].sort();
}
export async function main(args: string[]) {
  const { values } = parseArgs({ args, options: { breakage: { type: 'string' }, base: { type: 'string' }, head: { type: 'string' } } });
  if (!values.breakage || !/^[a-z-]+$/u.test(values.breakage) || !values.base || !values.head) throw new Error('Expected --breakage --base --head');
  const input: unknown = JSON.parse(await readFile(resolve(import.meta.dirname, values.breakage + '.json'), 'utf8'));
  let output = '', code = 0;
  try { output = (await exec(process.execPath, ['site/journeys/compare.mts', '--base', values.base, '--head', values.head], { maxBuffer: 16 * 1024 * 1024 })).stdout; }
  catch (error) {
    if (!(error instanceof Error) || !('code' in error) || typeof error.code !== 'number' || !('stdout' in error) || typeof error.stdout !== 'string') throw error;
    code = error.code; output = error.stdout;
  }
  if (code !== 1) throw new Error(`Breakage comparison must exit 1; got ${code}`);
  const actual = checkFamilies(expected(input), output);
  console.log(JSON.stringify({ breakage: values.breakage, compare: code, observedFamilies: actual, expectedFamiliesVerified: true }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await main(process.argv.slice(2)); } catch (error) { console.error(error); process.exitCode = 2; }
}
