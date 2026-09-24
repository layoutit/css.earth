// Compares recorded sidebar facts and screenshots: repeat runs, main against the change, and each planted bug.
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs'; import pixelmatch from 'pixelmatch';
const dir = new URL('./runs/', import.meta.url).pathname, prefix = process.argv[2] ?? '';
const facts = label => JSON.parse(readFileSync(`${dir}${label}/facts.json`, 'utf8'));
const differences = (a, b) => { const out = [];
  for (const flow in a) a[flow].steps.forEach((step, k) => { const other = b[flow]?.steps[k];
    for (const key in step) if (JSON.stringify(step[key]) !== JSON.stringify(other?.[key])) out.push(`${flow} / ${step.step} / ${key}`); });
  return out; };
const lines = [], reference = `${prefix}main-1`;
const runs = readdirSync(dir).filter(l => new RegExp(`^${prefix}(main|change)-\\d$`, 'u').test(l) && l !== reference).sort();
lines.push(`Facts against ${reference}:`);
for (const run of runs) { const d = differences(facts(reference), facts(run)); lines.push(`  ${run}: ${d.length ? d.length + ' differ: ' + d.join('; ') : 'identical'}`); }
lines.push(`Pixels against ${reference} (threshold 0.1 / 0), frames that differ:`);
for (const run of runs) {
  const differing = [];
  for (const png of readdirSync(`${dir}${reference}`).filter(f => f.endsWith('.png'))) {
    if (!existsSync(`${dir}${run}/${png}`)) { differing.push(`${png} missing`); continue; }
    const a = PNG.sync.read(readFileSync(`${dir}${reference}/${png}`)), b = PNG.sync.read(readFileSync(`${dir}${run}/${png}`));
    const loose = pixelmatch(a.data, b.data, null, a.width, a.height, { threshold: 0.1 }), strict = pixelmatch(a.data, b.data, null, a.width, a.height, { threshold: 0 });
    if (loose || strict) differing.push(`${png} ${loose}/${strict}`);
  }
  lines.push(`  ${run}: ${differing.length ? differing.join(', ') : 'all 0/0'}`);
}
const mutants = readdirSync(dir).filter(l => new RegExp(`^${prefix}mutant-`, 'u').test(l) && existsSync(`${dir}${l}/facts.json`)).sort();
if (mutants.length) lines.push(`Planted bugs against ${prefix}change-1:`);
for (const run of mutants) { const d = differences(facts(`${prefix}change-1`), facts(run)); lines.push(`  ${run}: ${d.length ? 'caught, ' + d.length + ' facts differ: ' + d.slice(0, 3).join('; ') : 'MISSED'}`); }
console.log(lines.join('\n'));
if (process.argv[3]) writeFileSync(process.argv[3], lines.join('\n') + '\n');
