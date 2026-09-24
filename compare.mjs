import { readFileSync, readdirSync, writeFileSync } from 'node:fs'; import { PNG } from 'pngjs'; import pixelmatch from 'pixelmatch';
const dir = new URL('./runs/', import.meta.url).pathname, runs = ['main-2', 'change-1', 'change-2'], lines = [];
lines.push('Idle browser frames per step (2 s after each step settles):');
for (const run of ['main-1', ...runs]) lines.push(`  ${run}: ${JSON.parse(readFileSync(`${dir}${run}/steps.json`)).steps.map(s => s.idleFrames).join(' ')}`);
lines.push('Changed pixels against main-1, threshold 0.1 / 0 (1280x800, DPR 1):');
lines.push('  ' + 'frame'.padEnd(26) + runs.map(r => r.padEnd(16)).join(''));
for (const png of readdirSync(`${dir}main-1`).filter(f => f.endsWith('.png')).sort()) {
  const a = PNG.sync.read(readFileSync(`${dir}main-1/${png}`));
  lines.push('  ' + png.padEnd(26) + runs.map(r => { const b = PNG.sync.read(readFileSync(`${dir}${r}/${png}`));
    return `${pixelmatch(a.data, b.data, null, a.width, a.height, { threshold: 0.1 })}/${pixelmatch(a.data, b.data, null, a.width, a.height, { threshold: 0 })}`.padEnd(16); }).join(''));
}
console.log(lines.join('\n')); writeFileSync(new URL('./app-comparison.txt', import.meta.url), lines.join('\n') + '\n');
