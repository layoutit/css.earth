/** A star placed by a pixel of an archived exposure (spec `position` with `archive: "mast"`), offline: the file served here has the
 * layout and the world-coordinate cards of u6fv0101m_c0m.fits (HST WFPC2, NGC 1637, 2001-09-02) as MAST served it on 2026-10-04,
 * with no image data, so a request for anything but a header fails the test. */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { card } from '@cssearth/fits/test-support';
import { sourceTest } from '@cssearth/objects/node/source-test';
import type { Archive } from '../archives.mts';
import { draftFromHoffmann, parseHoffmannRows } from '../sh0es.mts';
import { citedRow, duplicateStar } from '../../names/identity.mts';
import { loadSolarEpoch } from '../../solar-epoch.mts';
import { parseStarSpec } from '../../spec.mts';
import { draftsFromTable, parseTableRequest } from '../tables/table-stars.mts';
import { parseVizierMeta, starColumns } from '../tables/vizier-tables.mts';
import { fetchImagePixel, zeroBased } from './image-pixel.mts';

const test = sourceTest(), root = resolve(import.meta.dirname, '../../../../../..');
const RECORD = 2880, URL = 'https://mast.stsci.edu/api/v0.1/Download/file?uri=mast:HST/product/u6fv0101m_c0m.fits';
const header = (cards: readonly string[]) => { const text = [...cards, 'END'.padEnd(80)].join(''); return Buffer.from(text.padEnd(Math.ceil(text.length / RECORD) * RECORD), 'latin1'); };
// The WF4 chip's cards, and the PC chip's linear part with the same polynomials: enough to tell the two extensions apart.
const SIP = { A_ORDER: '3', B_ORDER: '3', A_0_2: '-4.693299899827253E-07', B_0_2: '-2.886434988684502E-06', A_1_1: '-2.780400109259062E-06', B_1_1: '-3.447691418182868E-06',
  A_2_0: '-3.477299969745218E-06', B_2_0: '-3.548399029829361E-07', A_0_3: '-1.137799993111699E-10', B_0_3: '-3.452507297057036E-08', A_1_2: '-3.555599903393159E-08',
  B_1_2: '4.237424806885753E-10', A_2_1: '4.171900047644783E-10', B_2_1: '-3.58329095184396E-08', A_3_0: '-3.453200037029092E-08', B_3_0: '-2.779383137962067E-10' };
const WCS: Readonly<Record<number, Readonly<Record<string, string>>>> = {
  1: { CRPIX1: '425.0', CRPIX2: '425.0', CRVAL1: '70.3613436056424', CRVAL2: '-2.852358488748628', CD1_1: '-1.022082552134806E-05', CD1_2: '-7.46099570749656E-06', CD2_1: '-7.449910949919314E-06', CD2_2: '1.021210047769117E-05' },
  4: { CRPIX1: '425.0', CRPIX2: '425.0', CRVAL1: '70.36567856558561', CRVAL2: '-2.86790072198885', CD1_1: '1.617442251788924E-05', CD1_2: '-2.245384389166951E-05', CD2_1: '-2.245237444586934E-05', CD2_2: '-1.618184770313391E-05' },
};
const extension = (version: number, ctype = 'TAN-SIP') => header([card('XTENSION', "'IMAGE   '"), card('BITPIX', '-32'), card('NAXIS', '2'), card('NAXIS1', '800'), card('NAXIS2', '800'), card('PCOUNT', '0'), card('GCOUNT', '1'),
  card('EXTNAME', "'SCI     '"), card('EXTVER', String(version)), card('CTYPE1', `'RA---${ctype}'`), card('CTYPE2', `'DEC--${ctype}'`),
  ...Object.entries({ ...WCS[version] ?? WCS[1]!, ...SIP }).map(([key, value]) => card(key, value))]);
/** A primary header of seven records, as the real one, then four 800 by 800 float extensions whose data are not held. */
function exposure(equinox = '2000.0', ctype?: string) {
  const primary = header([card('SIMPLE', 'T'), card('BITPIX', '16'), card('NAXIS', '0'), card('EXTEND', 'T'), card('EQUINOX', equinox), ...Array.from({ length: 220 }, (_, i) => card(`FILL${i}`, String(i)))]);
  const data = Math.ceil(800 * 800 * 4 / RECORD) * RECORD, headers = new Map<number, Buffer>([[0, primary]]);
  let offset = primary.length;
  for (const version of [1, 2, 3, 4]) { const bytes = extension(version, ctype); headers.set(offset, bytes); offset += bytes.length + data; }
  return { headers, size: offset };
}
function serving(file = exposure(), answers: readonly (readonly [string, string])[] = []) {
  const asked: { offset: number; length: number }[] = [];
  const archive: Archive = {
    async text(url, form) {
      const request = `${decodeURIComponent(url)} ${form?.QUERY ?? ''} ${form?.['-source'] ?? ''}`, answer = answers.find(([words]) => request.includes(words));
      if (answer) return answer[1];
      if (url.includes('export.arxiv.org')) return '<feed><entry><title>A paper</title><published>2003-05-15T00:00:00Z</published><author><name>D C Leonard</name></author></entry></feed>'; if (url.includes('asu-tsv')) return '#\n'; throw new Error(`unexpected ${url}`); },
    async bytes(url, range) {
      assert.equal(url, URL); assert.ok(range, 'the exposure is never asked for whole');
      asked.push(range);
      const start = [...file.headers.keys()].findLast(offset => offset <= range.offset)!, bytes = file.headers.get(start)!;
      // A request may run past a header into data the test does not hold: those bytes are zeros, as nothing reads them.
      const out = Buffer.alloc(range.length);
      bytes.copy(out, 0, range.offset - start, Math.min(bytes.length, range.offset - start + range.length));
      return out;
    },
    async exists() { return false; } };
  return { archive, asked };
}
const position = { archive: 'mast' as const, catalogue: 'mast:HST/product/u6fv0101m_c0m.fits', row: { extension: 'SCI,4', x: '213.1', y: '407.8' }, firstPixel: 0.5, credit: 'Leonard et al. (2003), ApJ 594, 247, table 6', url: 'https://arxiv.org/abs/astro-ph/0305259' };

test('a pixel a paper prints is placed through the exposure\'s own header, read by byte range and kept as that range', async () => {
  const { archive, asked } = serving(), row = await fetchImagePixel(archive, position, 'test');
  // SN 1999em, which Leonard et al. (2003) list at this pixel: SIMBAD holds it at 70.362667, -2.862556, 1.2" away.
  assert.ok(Math.abs(row.ra - 70.362633) < 1e-6 && Math.abs(row.dec + 2.862888) < 1e-6, `${row.ra}, ${row.dec}`);
  const arcsec = Math.hypot((row.ra - 70.362667) * Math.cos(row.dec * Math.PI / 180), row.dec + 2.862556) * 3600;
  assert.ok(arcsec > 1 && arcsec < 1.3, `${arcsec}" from SIMBAD's position: the exposure's pointing error`);
  assert.deepEqual([row.archive, row.words, row.epoch, row.columns], ['MAST', 'mast:HST/product/u6fv0101m_c0m.fits pixel extension = SCI,4, x = 213.1, y = 407.8, first pixel centre = 0.5', 2000, { ra: 'RA', dec: 'Dec' }]);
  // Seven records of primary header, then three extensions passed over: each header is one request, and the kept one is asked for again alone.
  const sci4 = 20160 + 3 * (2880 + 2560320);
  assert.deepEqual(row.image, { url: URL, file: 'u6fv0101m_c0m.fits', extension: 'SCI,4', range: { offset: sci4, length: 2880 } });
  assert.deepEqual(asked, [{ offset: 0, length: 23040 }, ...[0, 1, 2, 3].map(i => ({ offset: 20160 + i * (2880 + 2560320), length: 23040 })), { offset: sci4, length: 2880 }]);
  assert.equal(row.tsv.length, 2880); assert.match(row.tsv, /^XTENSION= 'IMAGE {3}'/u);
  // The same pixel read as DAOPHOT's or as zero-based lands half a pixel away each way: 0.05" on this chip.
  assert.deepEqual([zeroBased(213.1, 0.5), zeroBased(213.1, 1), zeroBased(213.1, 0)], [212.6, 212.1, 213.1]);
  const daophot = await fetchImagePixel(serving().archive, { ...position, firstPixel: 1 }, 'test');
  assert.ok(Math.abs(Math.hypot((daophot.ra - row.ra) * Math.cos(row.dec * Math.PI / 180), daophot.dec - row.dec) * 3600 - 0.0704) < 0.005);
  // Another chip of the same exposure is another header and another place on the sky.
  const pc = await fetchImagePixel(serving().archive, { ...position, row: { extension: 'SCI,1', x: '584.5', y: '490.2' } }, 'test');
  assert.deepEqual(pc.image!.range, { offset: 20160, length: 2880 });
  assert.ok(Math.hypot(pc.ra - row.ra, pc.dec - row.dec) * 3600 > 30);
});

test('what cannot be placed is refused with the product, the extension and the pixel', async () => {
  const at = /^test: MAST mast:HST\/product\/u6fv0101m_c0m\.fits pixel extension = SCI,\d, x = [\d.]+, y = 407\.8, first pixel centre = 0\.5: /u;
  const refused = async (change: Partial<typeof position['row']>, pattern: RegExp, file = exposure()) => assert.rejects(fetchImagePixel(serving(file).archive, { ...position, row: { ...position.row, ...change } }, 'test'),
    (error: Error) => { assert.match(error.message, at); assert.match(error.message, pattern); return true; });
  await refused({ x: '800.9' }, /the pixel is outside that extension's 800 by 800 image/u);
  await refused({}, /its coordinates are of equinox 1950, not J2000/u, exposure('1950.0'));
  await refused({}, /A sky projection needs RA---TAN and DEC--TAN axes/u, exposure('2000.0', 'ARC'));
  // An extension the file does not have: the headers are read to the end of the file, where the archive answers no more.
  const short = exposure(), { archive } = serving(short);
  const ended: Archive = { ...archive, async bytes(url, range) { if (range!.offset >= short.size) throw new Error(`${url} answered 416 Range Not Satisfiable.`); return archive.bytes(url, range); } };
  await assert.rejects(fetchImagePixel(ended, { ...position, row: { ...position.row, extension: 'SCI,5' } }, 'test'), /the file has no extension SCI,5 \(it has primary; SCI,1; SCI,2; SCI,3; SCI,4\)/u);
});

test('the spec names the product, the extension, the pixel and the paper\'s pixel convention', () => {
  const [parsed] = parseHoffmannRows(['Gal\tRAJ2000\tDEJ2000\tID\tPer\tF555W\tF814W\tSimbadName', ' \tdeg\tdeg\t \td\tmag\tmag\t', '-----', 'N4536\t188.59811\t+02.17822\t   38676\t11.854\t26.625\t25.953\t[HMR2016] N4536  38676'].join('\n'));
  const draft = draftFromHoffmann(parsed!, { value: 1802, uncertainty: 3, source: "SIMBAD's radial velocity of NGC 4536", url: 'https://ui.adsabs.harvard.edu/abs/2022ApJS..261...21Y/abstract' });
  const spec = (change: Record<string, unknown>) => parseStarSpec({ ...draft, position: { ...position, ...change } });
  assert.deepEqual(spec({}).position, position);
  assert.throws(() => spec({ firstPixel: undefined }), /position\.firstPixel is the coordinate the paper's software gives the centre of the first pixel: 0\.5 \(HSTphot, DOLPHOT\), 1 \(DAOPHOT, IRAF, FITS\) or 0, not undefined/u);
  assert.throws(() => spec({ catalogue: 'u6fv0101m_c0m.fits' }), /position\.catalogue is a MAST product \(mast:HST\/product\/u6fv0101m_c0m\.fits\), not u6fv0101m_c0m\.fits/u);
  for (const row of [{ extension: '4', x: '213.1', y: '407.8' }, { extension: 'SCI,4', x: '213.1' }, { extension: 'SCI,4', x: '213.1', y: '407.8', chip: '4' }, { extension: 'SCI,4', x: 'left', y: '407.8' }])
    assert.throws(() => spec({ row }), /position(?:\.row\.y)?:? (?:a pixel position is \{ "archive": "mast"|must be a string)/u, JSON.stringify(row));
  assert.throws(() => parseStarSpec({ ...draft, position: { ...(draft as { position: object }).position, firstPixel: 0.5 } }), /position\.firstPixel belongs to a pixel on an archived image \("archive": "mast"\)/u);
});

test('a whole package for a star placed by a pixel: the header kept as one byte range of the exposure, restored by a ranged download', async () => {
  const { generateStar } = await import('../../generate.mts');
  const [parsed] = parseHoffmannRows(['Gal\tRAJ2000\tDEJ2000\tID\tPer\tF555W\tF814W\tSimbadName', ' \tdeg\tdeg\t \td\tmag\tmag\t', '-----', 'N4536\t188.59811\t+02.17822\t   38676\t11.854\t26.625\t25.953\t[HMR2016] N4536  38676'].join('\n'));
  const { target: _target, ...draft } = draftFromHoffmann(parsed!, { value: 717, uncertainty: 3, source: "SIMBAD's radial velocity of NGC 1637", url: 'https://ui.adsabs.harvard.edu/abs/2022ApJS..261...21Y/abstract' }) as Record<string, unknown>;
  const spec = parseStarSpec({ ...draft, id: 'pixel-placed-cepheid', name: 'Pixel-placed Cepheid', position, limb: { none: 'a test fixture' } });
  const { archive } = serving(), universe = { ids: new Set<string>(), names: new Map<string, string>(), stars: [] };
  const generated = await generateStar(spec, { archive, root, order: 9996, universe, solarEpoch: await loadSolarEpoch(root), resolver: async () => { throw new Error('a pixel-placed star is not resolved through SIMBAD'); } });
  const o = `src/objects/${spec.id}`, files = generated.files, manifest = JSON.parse(String(files.get(`${o}/source/manifest.json`)));
  const input = manifest.inputs.find((entry: { id: string }) => entry.id === 'pixel-placed-cepheid-exposure-header'), range = { offset: 20160 + 3 * (2880 + 2560320), length: 2880 };
  assert.deepEqual([input.path, input.range, input.origin, input.license, input.redistribution], ['photometry/exposure-header.txt', range, URL, 'Public NASA mission data (MAST)', 'One image header, retained unchanged with its credit.']);
  assert.match(input.credit, /^Leonard et al\. \(2003\), ApJ 594, 247, table 6; u6fv0101m_c0m\.fits \(Mikulski Archive for Space Telescopes, STScI\)$/u);
  assert.match(input.acquisition, /the header of extension SCI,4 of u6fv0101m_c0m\.fits \(bytes 7709760 to 7712639\), whose world coordinates place the pixel\. The image itself is not fetched\./u);
  assert.ok(input.sourceBinding, 'the header has a source binding');
  assert.equal(String(files.get(`${o}/source/photometry/exposure-header.txt`)).length, 2880); assert.ok(!files.has(`${o}/source/photometry/catalogue-row.tsv`));
  const operation = JSON.parse(String(files.get(`${o}/source/preparation/acquisition.json`))).operations.find((entry: { path: string }) => entry.path === 'photometry/exposure-header.txt');
  assert.deepEqual(operation, { kind: 'download', groups: ['restore', 'refresh'], path: 'photometry/exposure-header.txt', url: URL });
  const body = JSON.parse(String(files.get(`packages/astronomy/data/bodies/${spec.id}.json`)));
  assert.ok(Math.abs(body.star.rightAscensionDegrees - 70.362633) < 1e-6 && Math.abs(body.star.declinationDegrees + 2.862888) < 1e-6);
  assert.match(body.star.sources.position, /^Leonard et al\. \(2003\), ApJ 594, 247, table 6 \(https:\/\/arxiv\.org\/abs\/astro-ph\/0305259\), MAST mast:HST\/product\/u6fv0101m_c0m\.fits pixel extension = SCI,4, x = 213\.1, y = 407\.8, first pixel centre = 0\.5: RA 70\.3626\d+, Dec -2\.8628\d+, from the archived header src\/objects\/pixel-placed-cepheid\/source\/photometry\/exposure-header\.txt$/u);
  assert.match(String(files.get(`${o}/NOTICE.md`)), /Placement: position from Leonard et al\. \(2003\), ApJ 594, 247, table 6, MAST mast:HST\/product\/u6fv0101m_c0m\.fits pixel [^(]+\(MAST, STScI\); distance:/u);
  assert.match(String(files.get(`${o}/README.md`)), /placed by that pixel, not by a Gaia source/u);
  // The same pixel of the same exposure is the same star; another pixel of it, however close, is another.
  const cited = citedRow(body.star.sources.position)!, held = { ids: new Set<string>(), names: new Map<string, string>(), stars: [{ id: 'held', ra: body.star.rightAscensionDegrees, dec: body.star.declinationDegrees, epoch: 2000, pmra: 0, pmdec: 0, row: cited }] };
  assert.deepEqual(cited, { table: 'mast:HST/product/u6fv0101m_c0m.fits', key: 'extension = SCI,4, x = 213.1, y = 407.8, first pixel centre = 0.5' });
  assert.equal(duplicateStar(held, { ra: 70.3626, dec: -2.8629, epoch: 2000, row: cited }), 'held');
  assert.equal(duplicateStar(held, { ra: 70.3626, dec: -2.8629, epoch: 2000, row: { ...cited, key: 'extension = SCI,4, x = 215.0, y = 407.8, first pixel centre = 0.5' } }), undefined);
});

test('a table of chips and pixels drafts a star through the exposure the request names, under the table\'s own name', async () => {
  // The columns of Gibson et al. (2000), VizieR J/ApJ/529/723/appen, as VizieR describes them; the row is NGC 1637's Cepheid 388 in
  // Leonard et al. (2003) written in that form, so the exposure served above places it. A second row has no chip, as that table's NGC 3368 rows.
  const column = (name: string, format: string, description: string, ucd: string) => `#Column\t${name}\t(${format})\t${description}\t[ucd=${ucd}]`, TABLE = 'J/ApJ/529/723/appen';
  const meta = ['#RESOURCE=yCat_15290723_1', `#Name: ${TABLE}`, '#Title:', '#INFO\tnrows=2\tNumber of rows of the table', '#Table\t:', `#Name: ${TABLE}`, '#Title:',
    column('recno', 'I8', 'Record number assigned by the VizieR team. Should Not be used for identification.', 'meta.record'), column('Cluster', 'a9', 'Cluster name', 'meta.id.parent'), column('CNN', 'A3', 'Cepheid number in the cluster (1)', 'meta.id;meta.main'),
    column('Chip', 'I1', '? Chip number', 'meta.id;instr'), column('Xpos', 'F6.1', 'X pixel position', 'pos.cartesian.x;instr.det'), column('Ypos', 'F6.1', 'Y pixel position', 'pos.cartesian.y;instr.det'), column('Per', 'F5.2', 'TRIAL period', 'time.period')].join('\n');
  assert.deepEqual(starColumns(parseVizierMeta(meta, TABLE)!.tables[0]!), { pixel: { x: 'Xpos', y: 'Ypos', chip: 'Chip' }, identifier: 'CNN', period: { column: 'Per', log: false }, position: false });
  const rows = ['_RAJ2000\t_DEJ2000\tCluster\tCNN\tChip\tXpos\tYpos\tPer', ' \t \t \t \t \tpix\tpix\td', '---\t---\t---------\t---\t-\t------\t------\t-----', ' \t \tNGC 1637 \tC01\t1\t 584.5\t 490.2\t36.57', ' \t \tNGC 1637 \tC02\t \t-446.5\t 252.3\t30.59'].join('\n');
  const readMe = ['J/ApJ/529/723       VI photometry of Cepheids                (Gibson+, 2000)', '='.repeat(80), 'The Hubble space telescope key project on the extragalactic distance scale.', '    Gibson B.K., Stetson P.B., Freedman W.L.', '   <Astrophys. J. 529, 723 (2000)>', '   =2000ApJ...529..723G', '='.repeat(80)].join('\n');
  const answers = [['-meta.all', meta], ['/ReadMe', readMe], ['rvz_radvel', 'rvz_radvel,rvz_err,rvz_bibcode\n717.0,3.0,"2022ApJS..261....6K"\n'], [TABLE, rows]] as const, request = `cepheid:ngc-1637=${TABLE}#exposure=mast:HST/product/u6fv0101m_c0m.fits,firstPixel=0.5`;
  assert.deepEqual(parseTableRequest(`${request},C01,featured`), { starClass: 'cepheid', galaxy: 'ngc-1637', table: TABLE, all: false, featured: true, named: 'C01', exposure: { product: 'mast:HST/product/u6fv0101m_c0m.fits', firstPixel: 0.5 }, filters: {} });
  assert.throws(() => parseTableRequest(`cepheid:ngc-1637=${TABLE}#exposure=mast:HST/product/u6fv0101m_c0m.fits`), /a table of detector pixels is placed with both exposure=mast:HST\/product\/FILE\.fits, the exposure they were measured on, and firstPixel=0\.5, 1 or 0/u);
  assert.throws(() => parseTableRequest(`cepheid:ngc-1637=${TABLE}#exposure=u6fv0101m,firstPixel=1`), /a table of detector pixels is placed with both/u);
  const { archive, asked } = serving(exposure(), answers), { stars, report } = await draftsFromTable([`${request},C01`], archive, root), spec = parseStarSpec(stars[0]);
  assert.deepEqual(report, [`${request},C01: 1 Cepheid of Gibson et al. (2000), ApJ 529, 723 in NGC 1637, placed by pixel on mast:HST/product/u6fv0101m_c0m.fits; radius and temperature from Groenewegen (2020), A&A 635, A33's period relations.`]);
  assert.deepEqual([spec.id, spec.name, spec.target, spec.parent], ['ngc-1637-cepheid-c01', 'NGC 1637 Cepheid C01', undefined, 'ngc-1637'], 'the star keeps its table\'s name and claims none in SIMBAD: SIMBAD is not asked which star lies there');
  assert.deepEqual(spec.position, { archive: 'mast', catalogue: 'mast:HST/product/u6fv0101m_c0m.fits', row: { extension: 'SCI,1', x: '584.5', y: '490.2' }, firstPixel: 0.5, url: 'https://doi.org/10.26093/cds/vizier.15290723',
    credit: 'Gibson et al. (2000), ApJ 529, 723, VizieR J/ApJ/529/723/appen CNN = C01 (Chip 1, Xpos 584.5, Ypos 490.2)' });
  assert.deepEqual(asked.at(-1), { offset: 20160, length: 2880 }, 'the star was placed in its galaxy from the header of chip 1');
  assert.ok(spec.distance!.value > 9.2e6 && spec.distance!.value < 9.4e6, 'on the disc NGC 1637 is drawn as');
  await assert.rejects(draftsFromTable([`${request},C02`], serving(exposure(), answers).archive, root), /J\/ApJ\/529\/723\/appen CNN = C02: Chip is "", not a chip number; its Xpos and Ypos are not of one detector's frame/u);
  await assert.rejects(draftsFromTable([`cepheid:ngc-1637=${TABLE}#C01`], serving(exposure(), answers).archive, root), /gives its rows no position of their own .* and no SIMBAD name; its stars cannot be placed from it/u);
});
