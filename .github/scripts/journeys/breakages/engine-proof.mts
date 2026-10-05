/** Require same-source healthy controls and the opposite engine outcomes for the startup tripwire. */
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
const controls = resolve(process.argv[2] ?? ''), out = resolve(process.argv[3] ?? '');
if (!relative(process.cwd(), controls).startsWith('output/') || !relative(process.cwd(), out).startsWith('output/')) throw new Error('Use local output paths');
await mkdir(out, { recursive: true });
async function command(args: string[], name: string, expectedCode: number, sentinel: string) {
  const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '', expired = false;
  const stop = () => { child.kill('SIGTERM'); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  const timeout = setTimeout(() => { expired = true; stop(); }, 300000);
  const force = setTimeout(() => child.kill('SIGKILL'), 305000);
  try {
    child.stdout.on('data', data => { output += String(data); });
    child.stderr.on('data', data => { output += String(data); });
    const code = await new Promise<number | null>((done, reject) => { child.once('error', reject); child.once('close', done); });
    await writeFile(resolve(out, name + '.log'), output);
    if (expired || code !== expectedCode || !output.includes(sentinel)) throw new Error(`${name}: missing positive proof (exit ${code})`);
    console.log(`VERIFIED ${name}: exit ${code}`);
  } finally {
    clearTimeout(timeout); clearTimeout(force);
    process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
  }
}
for (const profile of ['chromium-desktop', 'webkit-desktop']) {
  for (const view of ['healthy-a', 'healthy-b', 'broken']) await command(['site/journeys/run.mts', '--dist', resolve(controls, view),
    '--out', resolve(out, profile, view), '--journey', 'milky-way', '--profile', profile, '--repeat', '2'],
  `${profile}-${view}`, profile === 'webkit-desktop' && view === 'broken' ? 1 : 0,
  profile === 'webkit-desktop' && view === 'broken' ? 'JOURNEY ASSERTION FAILED' : 'DETERMINISTIC: exact repeats match');
  await command(['site/journeys/compare.mts', '--base', resolve(out, profile, 'healthy-a/run-1'),
    '--head', resolve(out, profile, 'healthy-b/run-1')], `${profile}-independent-control`, 0, 'IDENTICAL: validated traces and screenshots');
  if (profile === 'chromium-desktop') await command(['site/journeys/compare.mts', '--base', resolve(out, profile, 'healthy-a/run-1'),
    '--head', resolve(out, profile, 'broken/run-1')], `${profile}-negative-control`, 0, 'IDENTICAL: validated traces and screenshots');
  else await command(['.github/scripts/journeys/breakages/verify.mts', '--breakage', 'webkit-path', '--base', resolve(out, profile, 'healthy-a/run-1'),
    '--head', resolve(out, profile, 'broken/run-1')], `${profile}-fault`, 0, '"expectedFamiliesVerified":true');
}
await writeFile(resolve(out, 'result.json'), JSON.stringify({ healthyControls: 'exact in both engines', chromiumFault: 'exact green', webkitFault: 'errors red',
  scope: 'Equal-artifact synthetic startup tripwire; native engine-specific application branches not claimed.' }, null, 2) + '\n');
console.log('ENGINE PROOF COMPLETE');
