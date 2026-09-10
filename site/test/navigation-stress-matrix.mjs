import { spawn, execFileSync } from 'node:child_process';
import { mkdir, open, writeFile } from 'node:fs/promises';
import { OBJECTS } from '../objects.mts';

const planets = OBJECTS.filter(object => object.classification === 'planet');
const chains = [], seen = new Set(); let seed = Number(process.env.MATRIX_SEED ?? 424242) >>> 0;
while (chains.length < Math.min(6, planets.length)) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  let x = seed; x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  const start = planets[Math.floor((x >>> 0) / 4294967296 * planets.length)].id;
  if (seen.has(start)) continue;
  seen.add(start); chains.push({ seed, start, dpr: chains.length % 2 + 1, hops: Number(process.env.HOPS ?? 30) });
}
const output = process.env.OUTPUT ?? `output/playwright/navigation-stress-matrix/${new Date().toISOString().replaceAll(':', '-')}`;
await mkdir(output, { recursive: true });
const report = { head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), chains };
for (const chain of chains) {
  if (process.env.SEEDS && !process.env.SEEDS.split(',').includes(String(chain.seed))) continue;
  console.log('START', JSON.stringify(chain));
  const log = await open(`${output}/${chain.seed}.log`, 'w');
  chain.exit = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['site/test/navigation-stress-browser.mjs'], { env: { ...process.env,
      SEED: String(chain.seed), DPR: String(chain.dpr), HOPS: String(chain.hops), OUTPUT: `${output}/${chain.seed}` }, stdio: ['ignore', log.fd, log.fd] });
    child.once('error', reject); child.once('exit', resolve);
  });
  await log.close(); await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log('FINISH', JSON.stringify(chain));
}
if (chains.some(chain => chain.exit !== undefined && chain.exit !== 0)) process.exitCode = 1;
