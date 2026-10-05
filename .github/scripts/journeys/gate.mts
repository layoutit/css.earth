/** CI runs the tracked qualified lane, then gates only that lane's observed intersection. */
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
export async function main(args: string[]): Promise<number> {
  const { values } = parseArgs({ args, options: { dist: { type: 'string' }, checkout: { type: 'string' }, out: { type: 'string' },
    profiles: { type: 'string', default: 'chromium-desktop,webkit-desktop' } } });
  if (!values.dist || !values.out) throw new Error('Expected --dist and --out');
  const root = resolve(values.out); await mkdir(root, { recursive: true });
  async function command(args: string[], sentinel: string) {
    const child = spawn(process.execPath, ['site/journeys/run.mts', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', data => { output += String(data); process.stdout.write(data); });
    child.stderr.on('data', data => { output += String(data); process.stderr.write(data); });
    const terminate = () => { child.kill('SIGTERM'); };
    process.once('SIGINT', terminate); process.once('SIGTERM', terminate);
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; terminate(); }, 600000);
    const force = setTimeout(() => { child.kill('SIGKILL'); }, 605000);
    try {
      const code = await new Promise<number | null>((done, reject) => { child.once('error', reject); child.once('close', done); });
      return !timedOut && code === 0 && output.includes(sentinel);
    } finally { clearTimeout(timer); clearTimeout(force); process.removeListener('SIGINT', terminate); process.removeListener('SIGTERM', terminate); }
  }
  const evidence: unknown[] = [];
  const profiles = values.profiles.split(',');
  if (!profiles.length || new Set(profiles).size !== profiles.length) throw new Error('Duplicate or empty profiles');
  for (const profile of profiles) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(profile)) throw new Error('Invalid profile');
    const out = resolve(root, profile);
    if (!await command(['--dist', values.dist, '--out', out, '--profile', profile, '--gate', '--repeat', '2',
      ...(values.checkout ? ['--checkout', values.checkout] : [])], 'DETERMINISTIC: exact repeats match')) return 1;
    const input: unknown = JSON.parse(await readFile(resolve(out, 'run-observations.json'), 'utf8'));
    if (!Array.isArray(input) || !input.length) throw new Error('Missing current-lane observations');
    evidence.push(...input);
  }
  const file = resolve(root, 'lane-observations.json'); await writeFile(file, JSON.stringify(evidence, null, 2) + '\n');
  // The harness subprocess validates every row; no receipt, declaration or older output can add credit.
  const passed = await command(['--coverage', '--require', '--evidence', file], 'controls driven');
  await command(['--combinations', '--evidence', file], 'combinations');
  console.log(passed ? 'JOURNEY LANE COMPLETE' : 'JOURNEY LANE INCOMPLETE');
  return passed ? 0 : 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.exitCode = await main(process.argv.slice(2)); } catch (error) { console.error(error); process.exitCode = 2; }
}
