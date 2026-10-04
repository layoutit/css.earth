/** The toolchain lane must exercise its archive/CDF cases, never qualify a skipped run. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function requireAstroqueryTests(tap: string): void {
  const summary = (name: string): number => {
    const matches = [...tap.matchAll(new RegExp(`^# ${name} (\\d+)$`, 'gmu'))];
    if (matches.length !== 1) throw new Error(`Missing or ambiguous TAP ${name} summary.`);
    return Number(matches[0]![1]);
  };
  const tests = summary('tests'), passed = summary('pass');
  if (summary('skipped') !== 0 || /#\s*SKIP\b/iu.test(tap)) throw new Error('Astroquery tests skipped.');
  if (summary('fail') !== 0 || summary('cancelled') !== 0 || summary('todo') !== 0 || /^not ok\b/mu.test(tap))
    throw new Error('Astroquery tests did not pass.');
  if (tests < 13 || passed !== tests || [...tap.matchAll(/^ok \d+ - /gmu)].length !== tests)
    throw new Error('Astroquery lane requires at least 13 completed passing tests.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const path = process.argv[2];
  if (!path) throw new Error('Usage: astroquery-tests.mts <TAP file>');
  requireAstroqueryTests(await readFile(path, 'utf8'));
  console.log('All archive safety and CDF tests ran without skips.');
}
