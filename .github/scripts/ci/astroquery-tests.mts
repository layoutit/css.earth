/** The toolchain lane must exercise its archive/CDF cases, never qualify a skipped run. */
import { spawnSync } from 'node:child_process';
import { astroqueryLaneFiles } from './astroquery-discovery.mts';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function requireAstroqueryTests(tap: string, minimum = 1): void {
  const summary = (name: string): number => {
    const matches = [...tap.matchAll(new RegExp(`^# ${name} (\\d+)$`, 'gmu'))];
    if (matches.length !== 1) throw new Error(`Missing or ambiguous TAP ${name} summary.`);
    return Number(matches[0]![1]);
  };
  const tests = summary('tests'), passed = summary('pass');
  if (summary('skipped') !== 0 || /#\s*SKIP\b/iu.test(tap)) throw new Error('Astroquery tests skipped.');
  if (summary('fail') !== 0 || summary('cancelled') !== 0 || summary('todo') !== 0 || /^not ok\b/mu.test(tap))
    throw new Error('Astroquery tests did not pass.');
  if (tests < minimum || passed !== tests || [...tap.matchAll(/^ok \d+ - /gmu)].length !== tests)
    throw new Error('Astroquery lane requires completed passing tests.');
}

interface TestRun { readonly status: number | null; readonly stdout: string; readonly stderr: string; readonly error?: Error; }
export function runAstroqueryFiles(root: string, run: (file: string) => TestRun = file =>
  spawnSync(process.execPath, ['--test', '--test-reporter=tap', file], { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }),
): number {
  const files = astroqueryLaneFiles(root);
  if (!files.length) throw new Error('No astroquery tests discovered.');
  let ran = 0;
  for (const file of files) {
    const result = run(file);
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${file}: exit ${result.status}: ${result.stderr}`);
    requireAstroqueryTests(result.stdout);
    ran++;
  }
  if (ran !== files.length) throw new Error('Incomplete astroquery file run.');
  return ran;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve(import.meta.dirname, '../../..');
  const files = astroqueryLaneFiles(root);
  if (process.argv[2] === '--list') console.log(files.join('\n'));
  else if (process.argv[2] === '--run') {
    const ran = runAstroqueryFiles(root, file => {
      const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', file], { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
      process.stdout.write(result.stdout ?? '');
      process.stderr.write(result.stderr ?? '');
      return result;
    });
    console.log(`Astroquery: ran ${ran} files, 0 skipped (derived ${files.length}).`);
  } else {
    const path = process.argv[2];
    if (!path) throw new Error('Usage: astroquery-tests.mts <--list|--run|TAP file>');
    requireAstroqueryTests(await readFile(path, 'utf8'));
    console.log('All discovered astroquery tests ran without skips.');
  }
}
