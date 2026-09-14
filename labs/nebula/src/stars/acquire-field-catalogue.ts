import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';

const HIP_COLUMNS = ['HIP', 'RAICRS', 'DEICRS', 'Vmag', 'B-V', 'e_B-V', 'Plx', 'e_Plx', 'pmRA', 'pmDE', 'e_pmRA', 'e_pmDE'];
const TYCHO_COLUMNS = ['TYC1', 'TYC2', 'TYC3', 'RAmdeg', 'DEmdeg', 'pmRA', 'pmDE', 'e_pmRA', 'e_pmDE', 'BTmag', 'e_BTmag', 'VTmag', 'e_VTmag', 'HIP'];
const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown, label: string): string => { if (typeof v !== 'string' || !v) throw new TypeError(`Missing ${label}.`); return v; };
const num = (v: string | undefined): number | null => {
  if (!v?.trim()) return null;
  const n = Number(v); if (!Number.isFinite(n)) throw new TypeError(`Bad catalogue number: ${v}`); return n;
};
const must = (v: string | undefined): number => { const n = num(v); if (n === null) throw new TypeError('Missing catalogue number.'); return n; };
const round = (n: number) => Math.round(n * 1e10) / 1e10;

/** Validate the actual ASU response, including exact columns and record widths; reject HTML/error pages. */
export function readFieldCatalogueTsv(source: string, kind: 'hipparcos' | 'tycho2') {
  const expected = kind === 'hipparcos' ? HIP_COLUMNS : TYCHO_COLUMNS;
  const table = kind === 'hipparcos' ? 'I/239/hip_main' : 'I/259/tyc2';
  if (!source.includes(`#Name: ${table}\n`)) throw new TypeError(`Expected VizieR ${table}.`);
  const lines = source.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  if (lines[0] !== expected.join('\t') || !lines[2]?.split('\t').every(cell => /^-+$/.test(cell)))
    throw new TypeError('Catalogue columns or separator changed.');
  const rows = lines.slice(3).map(line => {
    const cells = line.split('\t'); if (cells.length !== expected.length) throw new TypeError('Invalid catalogue row width.');
    const row: Record<string, string> = {}; expected.forEach((name, i) => { row[name] = cells[i]!.trim(); });
    for (const cell of cells) num(cell); return row;
  });
  if (!rows.length) throw new TypeError('Catalogue query returned no stars.');
  // VizieR regenerates timestamps in headers; pin ordered scientific values separately.
  return { rows, dataSha256: sha(JSON.stringify(rows)) };
}
export interface ObservedFieldStar {
  id: string; hip: number | null; tycho: string[]; raDegrees: number; decDegrees: number;
  properMotionRaCosDecMasPerYear: number | null; properMotionDecMasPerYear: number | null;
  magnitudeV: number; colorIndexBV: number | null;
  photometry: { kind: 'johnson-measured' | 'tycho-johnson-approximation'; errorMagnitudeV: number | null;
    errorColorIndexBV: number | null; btMagnitude?: number | null; vtMagnitude?: number | null };
  sourceId: string; sourceEpochJulianYear: number; sourceRaDegrees: number; sourceDecDegrees: number;
  properMotionErrorRaCosDecMasPerYear: number | null; properMotionErrorDecMasPerYear: number | null;
  parallaxMas?: number | null; parallaxErrorMas?: number | null;
}
export function mergeFieldCatalogue(hipSource: string, tychoSource: string) {
  const hips = readFieldCatalogueTsv(hipSource, 'hipparcos').rows, tycs = readFieldCatalogueTsv(tychoSource, 'tycho2').rows;
  const stars: ObservedFieldStar[] = [], hipIds = new Set<number>(), skipped: { reason: string; id: string }[] = [];
  for (const r of hips) {
    const hip = must(r.HIP), ra = num(r.RAICRS), dec = num(r.DEICRS), mag = num(r.Vmag), pmra = num(r.pmRA), pmdec = num(r.pmDE);
    if (ra === null || dec === null || mag === null || pmra === null || pmdec === null) {
      skipped.push({ id: `HIP ${hip}`, reason: 'missing position, V or motion required for propagation' }); continue;
    }
    if (hipIds.has(hip)) throw new TypeError('Duplicate HIP identifier.'); hipIds.add(hip);
    stars.push({ id: `HIP ${hip}`, hip, tycho: tycs.filter(t => num(t.HIP) === hip).map(t => `${must(t.TYC1)}-${must(t.TYC2)}-${must(t.TYC3)}`),
      raDegrees: round(ra + pmra * 8.75 / 3.6e6 / Math.cos(dec * Math.PI / 180)), decDegrees: round(dec + pmdec * 8.75 / 3.6e6),
      properMotionRaCosDecMasPerYear: pmra, properMotionDecMasPerYear: pmdec, magnitudeV: mag, colorIndexBV: num(r['B-V']),
      photometry: { kind: 'johnson-measured', errorMagnitudeV: null, errorColorIndexBV: num(r['e_B-V']) },
      sourceId: 'hipparcos-esa-1997', sourceEpochJulianYear: 1991.25, sourceRaDegrees: ra, sourceDecDegrees: dec,
      properMotionErrorRaCosDecMasPerYear: num(r.e_pmRA), properMotionErrorDecMasPerYear: num(r.e_pmDE), parallaxMas: num(r.Plx), parallaxErrorMas: num(r.e_Plx) });
  }
  for (const r of tycs) {
    const hip = num(r.HIP), tycho = `${must(r.TYC1)}-${must(r.TYC2)}-${must(r.TYC3)}`;
    if (hip !== null && hipIds.has(hip)) continue;
    const ra = num(r.RAmdeg), dec = num(r.DEmdeg), bt = num(r.BTmag), vt = num(r.VTmag), eb = num(r.e_BTmag), ev = num(r.e_VTmag);
    if (ra === null || dec === null || bt === null || vt === null) {
      skipped.push({ id: `TYC ${tycho}`, reason: 'missing position or BT/VT color needed for Johnson approximation' }); continue;
    }
    stars.push({ id: `TYC ${tycho}`, hip, tycho: [tycho], raDegrees: ra, decDegrees: dec,
      properMotionRaCosDecMasPerYear: num(r.pmRA), properMotionDecMasPerYear: num(r.pmDE), magnitudeV: round(vt - .09 * (bt - vt)),
      colorIndexBV: round(.85 * (bt - vt)), photometry: { kind: 'tycho-johnson-approximation',
        errorMagnitudeV: eb !== null && ev !== null ? round(Math.hypot(.09 * eb, 1.09 * ev)) : null,
        errorColorIndexBV: eb !== null && ev !== null ? round(.85 * Math.hypot(eb, ev)) : null, btMagnitude: bt, vtMagnitude: vt },
      sourceId: 'tycho2-hog-2000', sourceEpochJulianYear: 2000, sourceRaDegrees: ra, sourceDecDegrees: dec,
      properMotionErrorRaCosDecMasPerYear: num(r.e_pmRA), properMotionErrorDecMasPerYear: num(r.e_pmDE) });
  }
  stars.sort((a, b) => a.magnitudeV - b.magnitudeV || a.id.localeCompare(b.id));
  if (new Set(stars.map(s => s.id)).size !== stars.length) throw new TypeError('Duplicate catalogue identifier.');
  for (const star of stars) if (star.raDegrees < 0 || star.raDegrees >= 360 || Math.abs(star.decDegrees) > 90)
    throw new TypeError('Catalogue coordinate outside ICRS range.');
  return { stars, skipped, hipparcosInput: hips.length, tychoInput: tycs.length };
}
/** Reproduce a bounded cone from its evidence file; raw-response headers may change, scientific rows may not. */
export async function acquireFieldCatalogue(root: string, evidencePath: string) {
  const evidence: unknown = JSON.parse(await readFile(resolve(root, evidencePath), 'utf8'));
  if (!record(evidence) || evidence.schema !== 'cssearth-stellar-source-evidence@1' || !record(evidence.catalogue) || !Array.isArray(evidence.inputs))
    throw new TypeError('Invalid stellar source evidence.');
  const catalogueId = text(evidence.id, 'catalogue identity');
  const output = resolve(root, text(evidence.catalogue.path, 'catalogue path'));
  if (relative(root, output).startsWith('..')) throw new TypeError('Catalogue output must remain in repository.');
  const sourceText: string[] = [];
  for (const kind of ['hipparcos', 'tycho2'] as const) {
    const pin: unknown = evidence.inputs.find((v: unknown) => record(v) && v.kind === kind);
    if (!record(pin)) throw new TypeError(`Missing ${kind} source.`);
    const path = resolve(root, text(pin.path, 'cache path')), expected = text(pin.dataSha256, 'scientific-row hash');
    if (relative(root, path).startsWith('..')) throw new TypeError('Cache must remain in repository.');
    let bytes: Buffer;
    try { bytes = await readFile(path); } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
      const response = await fetch(text(pin.url, 'source URL'), { signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(`Catalogue download failed: ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
      if (readFieldCatalogueTsv(bytes.toString(), kind).dataSha256 !== expected) throw new Error('Downloaded scientific catalogue changed.');
      await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes);
    }
    if (readFieldCatalogueTsv(bytes.toString(), kind).dataSha256 !== expected) throw new Error('Cached scientific catalogue changed.');
    sourceText.push(bytes.toString());
  }
  const prepared = mergeFieldCatalogue(sourceText[0]!, sourceText[1]!);
  const result = { schema: 'cssearth-observed-stellar-catalogue@1', id: catalogueId, frame: 'ICRS', coordinateEpochJulianYear: 2000, stars: prepared.stars };
  const bytes = JSON.stringify(result, null, 2) + '\n';
  if (sha(bytes) !== text(evidence.catalogue.sha256, 'prepared catalogue hash')) throw new Error('Catalogue replay did not reproduce pinned output.');
  await mkdir(dirname(output), { recursive: true }); await writeFile(output, bytes);
  return { cataloguePath: relative(root, output), stars: result.stars.length, skipped: prepared.skipped.length, sha256: sha(bytes) };
}
