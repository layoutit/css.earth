import { readVmcRecipe } from './vmc-recipe.ts';
import { redClumpDistanceKpc, unambiguousMatch } from '@cssearth/nebula-reconstruction/registration/red-clump-distance';
/** Offline cross-match of preserved Tatton RC rows to public ESO DR5 PSF measurements. */
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const recipe = await readVmcRecipe();
const base = recipe.localDirectory;
const hash = (b: Uint8Array | string) => createHash('sha256').update(b).digest('hex');
const quantile = (a: number[], p: number) => { const s = [...a].sort((a, b) => a - b); return s[Math.floor((s.length - 1) * p)] ?? null; };
const raw = await readFile(`${base}/rcsmcext.dat.gz`);
const rc = gunzipSync(raw).toString().trim().split('\n').map((line, i) => { const v = line.trim().split(/\s+/).map(Number); if (v.length !== 4 || !v.every(Number.isFinite))
    throw Error(`Invalid RC row ${i}`); return { ra: v[0]!, dec: v[1]!, e: v[2]!, smooth: v[3]! }; });
const bins = new Map<string, number[]>();
rc.forEach((r, i) => { const k = `${Math.floor(r.ra * 100)},${Math.floor(r.dec * 100)}`; const b = bins.get(k) ?? []; b.push(i); bins.set(k, b); });
type Photo = {
    id: number;
    tile: string;
    ra: number;
    dec: number;
    y: number;
    ks: number;
    ke: number;
    ye: number;
    sharp: number | null;
    prob: number | null;
    prior: number | null;
    comp: number | null;
    sys: number | null;
};
function parse(text: string): Photo[] { const data: unknown = JSON.parse(text); if (!data || typeof data !== 'object' || !('metadata' in data) || !('data' in data) || !Array.isArray(data.metadata) || !Array.isArray(data.data))
    throw Error('Invalid TAP response'); const cols = data.metadata.map((x: unknown) => { if (!x || typeof x !== 'object' || !('name' in x) || typeof x.name !== 'string')
    throw Error('Invalid metadata'); return x.name; }); return data.data.map((r: unknown) => { if (!Array.isArray(r))
    throw Error('Invalid row'); const num = (key: string, optional = false) => { const v: unknown = r[cols.indexOf(key)]; if (optional && v === null)
    return null; if (typeof v !== 'number' || !Number.isFinite(v))
    throw Error(`Invalid ${key}`); return v; }; const tile: unknown = r[cols.indexOf('FIELDNAME')]; if (typeof tile !== 'string')
    throw Error('Invalid tile'); return { id: num('PSFSOURCEID')!, tile, ra: num('RA2000')!, dec: num('DEC2000')!, y: num('YPSFMAG')!, ks: num('KSPSFMAG')!, ke: num('KSPSFMAGERR')!, ye: num('YPSFMAGERR')!, sharp: num('KSSHARP', true), prob: num('STARPROB', true), prior: num('PRIORSEC', true), comp: num('LCOMPKS', true), sys: num('SYSERRKS', true) }; }); }
function nearby(p: Photo) { const result: {
    i: number;
    sep: number;
}[] = []; for (let x = -1; x <= 1; x++)
    for (let y = -1; y <= 1; y++)
        for (const i of bins.get(`${Math.floor(p.ra * 100) + x},${Math.floor(p.dec * 100) + y}`) ?? []) {
            const r = rc[i]!;
            const sep = Math.hypot((p.ra - r.ra) * Math.cos(r.dec * Math.PI / 180), p.dec - r.dec) * 3600;
            if (sep <= 0.5)
                result.push({ i, sep });
        } return result; }
type Match = {
    p: Photo;
    sep: number;
    colorResidual: number;
};
const matched: (Match | undefined)[] = new Array(rc.length).fill(undefined);
const files = (await readdir(`${base}/photometry`)).filter(f => f.endsWith('.json')).sort();
const second = new Float64Array(rc.length).fill(Infinity);
const sources: unknown[] = [];
const tiles: unknown[] = [];
let examined = 0;
for (const file of files) {
    const bytes = await readFile(`${base}/photometry/${file}`);
    const rows = parse(bytes.toString());
    examined += rows.length;
    const deltas: number[] = [];
    for (const p of rows)
        for (const c of nearby(p))
            if (c.sep < 0.25)
                deltas.push(p.y - p.ks - recipe.intrinsicColorMag - rc[c.i]!.e);
    const offset = quantile(deltas, .5);
    if (offset === null)
        throw Error('No calibration matches ' + file);
    let accepted = 0;
    for (const p of rows)
        for (const c of nearby(p)) {
            const residual = p.y - p.ks - recipe.intrinsicColorMag - rc[c.i]!.e - offset;
            const prev = matched[c.i];
            if (prev && prev.p.id !== p.id) {
                second[c.i] = Math.min(second[c.i]!, Math.max(c.sep, prev.sep));
            }
            if (!prev || c.sep < prev.sep) {
                matched[c.i] = { p, sep: c.sep, colorResidual: residual };
                accepted++;
            }
        }
    sources.push({ path: `${base}/photometry/${file}`, sha256: hash(bytes), rows: rows.length, queryPath: `${base}/photometry/${file}.query.txt` });
    tiles.push({ tile: file.replace('.json', ''), colorOffsetMag: offset, colorOffsetP10: quantile(deltas, .1), colorOffsetP90: quantile(deltas, .9), acceptedUpdates: accepted });
    console.log(file, rows.length, offset, accepted);
}
const lines = ['raDeg\tdecDeg\tdistanceKpc\tksMag\tksErrorMag\treddening\tmatchSeparationArcsec\tsourceId\trcRow\ttile\tyMag\tyErrorMag\tcolorResidualMag\tpriorSec\tcompletenessKs\tsystematicKsMag\tstarProbability\tsharpKs'];
const sep: number[] = [], dist: number[] = [], err: number[] = [], res: number[] = [];
const missing: number[] = [];
const unique = new Set<number>();
matched.forEach((m, i) => { if (!m || !unambiguousMatch(m.sep, second[i]!)) {
    missing.push(i + 1);
    return;
} const r = rc[i]!; const d = redClumpDistanceKpc(m.p.ks, r.e, recipe.calibration); if (!Number.isFinite(d) || d <= 0)
    throw Error('Invalid distance'); unique.add(m.p.id); sep.push(m.sep); dist.push(d); err.push(m.p.ke); res.push(Math.abs(m.colorResidual)); lines.push([r.ra, r.dec, d, m.p.ks, m.p.ke, r.e, m.sep, m.p.id, i + 1, m.p.tile, m.p.y, m.p.ye, m.colorResidual, m.p.prior, m.p.comp, m.p.sys, m.p.prob, m.p.sharp].join('\t')); });
const output = lines.join('\n') + '\n';
await writeFile(`${base}/matched-rc.tsv`, output);
await writeFile(`${base}/unmatched-rc-rows.json`, JSON.stringify(missing));
await mkdir('labs/nebula/models/smc/vmc', { recursive: true });
const receipt = { schema: 'cssearth-vmc-red-clump@1', status: 'observational-standard-candle-estimates-not-exact-paper-reproduction', paper: 'https://doi.org/10.1093/mnras/staa3857', photometryRelease: 'VMC DR5.1 public PSF catalogue vmc_dr5_psf_yjks_V3', releaseDocumentation: 'https://www.eso.org/rm/api/v1/public/releaseDescriptions/155', catalogue: { path: `${base}/rcsmcext.dat.gz`, sha256: hash(raw), rows: rc.length, url: 'https://cdsarc.cds.unistra.fr/ftp/J/MNRAS/504/2983/rcsmcext.dat.gz' }, sources, output: { path: `${base}/matched-rc.tsv`, sha256: hash(output), rows: sep.length, uniquePhotometryIds: unique.size }, formula: { ks0: `KSPSFMAG - ${recipe.calibration.extinctionPerReddening} * max(0, published E(Y-Ks))`, distanceKpc: `${recipe.calibration.referenceDistanceKpc} * 10 ** ((ks0 - ${recipe.calibration.referenceMagnitude}) / 5)` }, matching: { radiusArcsec: 0.5, colorToleranceMag: null, method: 'Nearest angular match within 0.5 arcsec; reject second distinct PSF source within 0.05 arcsec of the nearest separation. Per-tile colour-offset residual is diagnostic only; all matched published RC rows retained, including original overlap measurements.', separationMedianArcsec: quantile(sep, .5), separationP90Arcsec: quantile(sep, .9), separationMaxArcsec: sep.reduce((a, b) => Math.max(a, b), 0), colorAbsoluteResidualP90Mag: quantile(res, .9), unmatchedRows: missing.length, noPhotometryWithinRadius: matched.filter(m => !m).length, ambiguousCloseTies: matched.filter((m, i) => m && !unambiguousMatch(m.sep, second[i])).length }, distanceKpc: { p01: quantile(dist, .01), p10: quantile(dist, .1), median: quantile(dist, .5), p90: quantile(dist, .9), p99: quantile(dist, .99) }, ksErrorMag: { median: quantile(err, .5), p90: quantile(err, .9) }, tiles, examinedPhotometryRows: examined, limits: ['Apparent depth includes red-clump intrinsic luminosity scatter, photometric errors, reddening errors and population contamination; no deconvolution or claim that each distance is geometrically measured.', 'Published reddening predates the public DR5.1 photometric zero-point alignment. DR5.1 documentation reports mean Ks shift -0.007 mag with tile scatter 0.008 and Y-Ks shift -0.022 with scatter 0.018; individual original Ks tile shifts are not supplied, so exact Tatton distances cannot be reproduced. No empirical image-fitting correction is applied.', 'Per-tile colour offsets are matching diagnostics only; they do not alter magnitudes, reddening or distances.', 'Input retrieval magnitude and colour bounds are broad matching preselection, not an astrophysical boundary. Unmatched rows are explicitly counted.', 'All matched catalogue entries retained. Tile-overlap measurements can repeat physical stars; unique source counts are not a calibrated stellar mass density.', 'Published source selection and survey footprint impose completeness limits. Quality columns are retained rather than imposing new sample cuts.'], reproduce: ['node --experimental-strip-types labs/nebula/packages/lab/src/cli/commands/acquire-vmc-psf.ts', 'node --experimental-strip-types labs/nebula/packages/lab/src/cli/commands/prepare-vmc-red-clump.ts', 'node --experimental-strip-types labs/nebula/packages/lab/src/cli/commands/deduplicate-vmc-red-clump.ts'] };
await writeFile('labs/nebula/models/smc/vmc/crossmatch-receipt.json', JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ rows: sep.length, unmatched: missing.length, dist: receipt.distanceKpc, match: receipt.matching }));
