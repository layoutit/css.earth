/** Bounded 10+30 exact qualification through subprocess boundaries; stop on the first unstable pair. */
import { spawn } from 'node:child_process';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

export async function main(args: string[]): Promise<number> {
  const { values } = parseArgs({ args, options: { dist: { type: 'string' }, out: { type: 'string' },
    journey: { type: 'string' }, profile: { type: 'string' } } });
  if (!values.dist || !values.out || !values.journey || !values.profile) throw new Error('Expected --dist --out --journey --profile');
  const root = resolve(values.out);
  await mkdir(root, { recursive: true });
  const results: { journey: string; profile: string; exactCaptures: number; status: string }[] = [];
  async function command(args: string[], log: string, sentinel: string): Promise<boolean> {
    const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '', timedOut = false;
    const terminate = () => { child.kill('SIGTERM'); };
    process.once('SIGINT', terminate); process.once('SIGTERM', terminate);
    const timeout = setTimeout(() => { timedOut = true; terminate(); }, 600000);
    const force = setTimeout(() => { child.kill('SIGKILL'); }, 605000);
    try {
      child.stdout.on('data', data => { output += String(data); });
      child.stderr.on('data', data => { output += String(data); });
      const code = await new Promise<number | null>((done, reject) => { child.once('error', reject); child.once('close', done); });
      await writeFile(log, output);
      console.log(`${log}: exit ${code}${timedOut ? ' timeout' : ''}`);
      return !timedOut && code === 0 && output.includes(sentinel);
    } finally {
      clearTimeout(timeout); clearTimeout(force);
      process.removeListener('SIGINT', terminate); process.removeListener('SIGTERM', terminate);
    }
  }
  for (const journey of values.journey.split(',')) for (const profile of values.profile.split(',')) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(journey) || !['chromium-desktop', 'webkit-desktop'].includes(profile)) throw new Error('Invalid journey/profile');
    const result = { journey, profile, exactCaptures: 0, status: 'experimental' };
    results.push(result);
    const pair = resolve(root, profile, journey);
    await mkdir(pair, { recursive: true });
    for (let batch = 0; batch < 4; batch++) {
      const out = resolve(pair, `batch-${batch + 1}`);
      if (await stat(out).catch(() => null)) throw new Error(`Refusing existing qualification artifacts ${out}`);
      console.log(`CAPTURING ${journey}/${profile} batch ${batch + 1}/4`);
      let passed = await command(['site/journeys/run.mts', '--dist', values.dist, '--out', out,
        '--journey', journey, '--profile', profile, '--repeat', '10'], resolve(pair, `batch-${batch + 1}.log`), 'DETERMINISTIC: exact repeats match');
      if (passed && batch > 0) passed = await command(['site/journeys/compare.mts', '--base', resolve(pair, 'batch-1/run-1'),
        '--head', resolve(out, 'run-1')], resolve(pair, `boundary-${batch + 1}.log`), 'IDENTICAL: validated traces and screenshots');
      if (!passed) {
        await writeFile(resolve(root, 'results.json'), JSON.stringify(results, null, 2) + '\n');
        console.log(`STOP UNSTABLE ${journey}/${profile}; qualification unchanged`);
        return 1;
      }
      result.exactCaptures += 10;
      if (batch === 3) {
        if (!await command(['site/journeys/run.mts', '--credit', pair, '--journey', journey, '--profile', profile], resolve(pair, 'credit.log'), 'CREDITED: 40 exact instrumented captures')) throw new Error('Observed qualification credit failed');
        result.status = 'qualified';
      }
      await writeFile(resolve(root, 'results.json'), JSON.stringify(results, null, 2) + '\n');
    }
  }
  console.log('QUALIFICATION COMPLETE');
  return 0;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.exitCode = await main(process.argv.slice(2)); }
  catch (error) { console.error(error); process.exitCode = 2; }
}
