import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const base = '.local/nebula-lab/smc-vmc';
const text = await readFile(`${base}/matched-rc.tsv`, 'utf8');
const lines = text.trim().split('\n');
const header = lines.shift()!;
const cols = header.split('\t');
const ix = (k: string) => { const n = cols.indexOf(k); if (n < 0)
    throw Error(k); return n; };
const rows = lines.map(l => l.split('\t'));
const ra = ix('raDeg'), dec = ix('decDeg'), sid = ix('sourceId'), tile = ix('tile'), err = ix('ksErrorMag'), sep = ix('matchSeparationArcsec');
const parent = Int32Array.from(rows, (_, i) => i);
function find(i: number): number { while (parent[i] !== i) {
    parent[i] = parent[parent[i]!]!;
    i = parent[i]!;
} return i; }
function join(a: number, b: number) { parent[find(a)] = find(b); }
const ids = new Map<string, number>();
const bins = new Map<string, number[]>();
let sameIdPairs = 0, overlapPairs = 0;
rows.forEach((r, i) => { const old = ids.get(r[sid]!); if (old !== undefined) {
    join(old, i);
    sameIdPairs++;
}
else
    ids.set(r[sid]!, i); const x = Math.floor(Number(r[ra]) * 1000), y = Math.floor(Number(r[dec]) * 1000); for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++)
        for (const j of bins.get(`${x + dx},${y + dy}`) ?? []) {
            const q = rows[j]!;
            if (q[tile] === r[tile])
                continue;
            const d = Math.hypot((Number(r[ra]) - Number(q[ra])) * Math.cos(Number(r[dec]) * Math.PI / 180), Number(r[dec]) - Number(q[dec])) * 3600;
            if (d <= .3) {
                join(i, j);
                overlapPairs++;
            }
        } const k = `${x},${y}`; const b = bins.get(k) ?? []; b.push(i); bins.set(k, b); });
const best = new Map<number, number>();
rows.forEach((r, i) => { const root = find(i), old = best.get(root); if (old === undefined || Number(r[err]) < Number(rows[old]![err]) || (Number(r[err]) === Number(rows[old]![err]) && Number(r[sep]) < Number(rows[old]![sep])))
    best.set(root, i); });
const output = header + '\n' + [...best.values()].sort((a, b) => a - b).map(i => lines[i]).join('\n') + '\n';
await writeFile(`${base}/density-rc.tsv`, output);
const receipt = JSON.parse(await readFile('labs/nebula/models/smc/vmc/crossmatch-receipt.json', 'utf8'));
receipt.densityCatalogue = { path: `${base}/density-rc.tsv`, sha256: createHash('sha256').update(output).digest('hex'), rows: best.size, removedRepeatedMeasurements: rows.length - best.size, samePhotometryIdPairs: sameIdPairs, crossTileOverlapPairs: overlapPairs, policy: 'Connected components of identical public PSF IDs or pairs in different tiles within 0.3 arcsec. Keep the lowest Ks uncertainty, then lowest matching separation. No averaging of distance or position. Original measurement catalogue remains preserved.', limitation: 'Cross-tile positional deduplication may merge unresolved close pairs. Counts represent selected RC tracers, not a completeness-corrected stellar mass density.' };
await writeFile('labs/nebula/models/smc/vmc/crossmatch-receipt.json', JSON.stringify(receipt, null, 2) + '\n');
console.log(receipt.densityCatalogue);
