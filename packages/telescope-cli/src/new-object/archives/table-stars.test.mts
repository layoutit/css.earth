/** Stars of another galaxy from any VizieR table (table-stars.mts, vizier-tables.mts) and the two ways the generator places them
 * (a table row's decimal position, SIMBAD's position of a name), offline. The fixtures are lines VizieR, the CDS archive and SIMBAD
 * served on 2026-10-04: Gerke et al. (2011) for M81, whose table has each star's position, and Kanbur et al. (2003), a reanalysis
 * of the Hubble Key Project galaxies whose table gives every row its galaxy's centre and a SIMBAD name. */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { catalogueRowForm, catalogueRowUrl, parseCatalogueRow, rowArchive, SIMBAD_TAP, VIZIER_ASU, type Archive } from './archives.mts';
import { citedRow } from '../identity.mts';
import { parseStarSpec } from '../spec.mts';
import { bibcodeReference, draftsFromTable, paperCredit, parseTableRequest, pickRows, placeInGalaxy, readGalaxy } from './table-stars.mts';
import { catalogueOf, parseVizierMeta, parseVizierReadMe, starColumns, vizierDataRows, vizierReadMeUrl } from './vizier-tables.mts';

const test = sourceTest(), root = resolve(import.meta.dirname, '../../../../..');
const column = (name: string, format: string, description: string, ucd = '') => `#Column\t${name}\t(${format})\t${description}\t[ucd=${ucd}]`;
const meta = (table: string, rows: number, columns: readonly string[]) => [`#RESOURCE=yCat_1`, `#Name: ${table}`, '#Title:', `#INFO\tnrows=${rows}\tNumber of rows of the table`, '#Table\t:', `#Name: ${table}`, '#Title:', ...columns].join('\n');
const RECNO = column('recno', 'I8', 'Record number assigned by the VizieR team. Should Not be used for identification.', 'meta.record');
const GERKE = 'J/ApJ/743/176/table1', gerkeMeta = meta(GERKE, 126, [RECNO, column('M81C', 'A18', 'Cepheid identification (HHMMSS.ss+DDMMSS.s; J2000) (1)', 'meta.id;meta.main'),
  column('f_M81C', 'a5', 'Removed Cepheid from final sample (3)', 'meta.code'), column('Per', 'F6.3', '[10/99] Period', 'time.period'), column('Vmag', 'F5.2', 'Calibrated phase-averaged mean V-band magnitude', 'phot.mag;em.opt.R'),
  column('F94', 'A3', 'ID from Freedman et al. (2)', 'meta.id.cross'), column('_RA', 'F9.5', 'Positions from Cepheid names (right ascension part)', 'pos.eq.ra;meta.main'), column('_DE', 'F9.5', 'Positions from Cepheid names (declination part)', 'pos.eq.dec;meta.main')]);
const gerkeRows = ['_RAJ2000\t_DEJ2000\tM81C\tf_M81C\tPer\tVmag\tF94\t_RA\t_DE', 'deg\tdeg\t \t \td\tmag\t \tdeg\tdeg', '-----------\t-----------\t------------------\t-----\t------\t-----\t---\t---------\t---------',
  '149.0622917\t+69.0280556\t095614.95+690141.0\t     \t10.241\t23.78\t   \t149.06229\t+69.02806', '149.0511250\t+69.1208056\t095612.27+690714.9\tOU   \t11.000\t23.96\t   \t149.05112\t+69.12081',
  '149.0442500\t+69.1257500\t095610.62+690732.7\t     \t64.823\t22.03\tC26\t149.04425\t+69.12575', '148.9000000\t+69.0700000\t095536.00+690412.0\t     \t80.000\t21.90\t   \t148.90000\t+69.07000'].join('\n');
const gerkeReadMe = ['J/ApJ/743/176          BVI photometry of Cepheids in M81          (Gerke+, 2011)', '='.repeat(80), 'A study of Cepheids in M81 with the Large Binocular Telescope (efficiently', 'calibrated with Hubble Space Telescope).',
  '    Gerke J.R., Kochanek C.S., Prieto J.L., Stanek K.Z., Macri L.M.', '   <Astrophys. J., 743, 176 (2011)>', '   =2011ApJ...743..176G', '='.repeat(80), 'ADC_Keywords: Galaxies, nearby ; Photometry, HST ; Stars, variable'].join('\n');
const KANBUR = 'J/A+A/411/361/table1', kanburMeta = meta(KANBUR, 725, [RECNO, column('Galaxy', 'a8', 'Galaxy name'), column('Cepheid', 'a5', 'Name of the Cepheid in the galaxy'), column('log(P)', 'F6.3', 'Period'), column('Vmag', 'F6.3', 'V band mean magnitude'),
  column('SName', 'a18', 'Simbad designation of the Cepheid'), column('Simbad', 'a6', 'Simbad column added by the CDS'), column('_RA', 'F8.4', 'Position of the parent Galaxy (from NED) (right ascension part)', 'pos.eq.ra;meta.main'),
  column('_DE', 'F8.4', 'Position of the parent Galaxy (from NED) (declination part)', 'pos.eq.dec;meta.main')]);
const kanburRows = ['_RAJ2000\t_DEJ2000\tGalaxy\tCepheid\tlog(P)\tVmag\tSName\tSimbad\t_RA\t_DE', 'deg\tdeg\t \t \t[d]\tmag\t \t \tdeg\tdeg', '----------\t----------\t--------\t-----\t------\t------\t------------------\t------\t--------\t--------',
  '160.990542\t+11.703611\tNGC3351 \tC1   \t 1.633\t24.447\t[GPF97] c1        \tSimbad\t160.9905\t+11.7036', '160.990542\t+11.703611\tNGC3351 \tC2   \t 1.613\t24.424\t[GPF97] c2        \tSimbad\t160.9905\t+11.7036',
  '185.728750\t+15.822389\tNGC4321 \tC2   \t 1.883\t25.163\t[FFH96] C2        \tSimbad\t185.7287\t+15.8224', '185.728750\t+15.822389\tNGC4321 \tC3   \t 1.803\t25.053\t[FFH96] C3        \tSimbad\t185.7287\t+15.8224'].join('\n');
const kanburReadMe = ['J/A+A/411/361         VI photometry of extra-galactic Cepheids   (Kanbur+, 2003)', '='.repeat(80), 'The extra-galactic Cepheid distance scale from LMC and', 'Galactic period-luminosity relations.',
  '    Kanbur S., Ngeow C., Nikolaev S., Tanvir N.R., Hendry M.A.', '   <Astron. Astrophys. 411, 361 (2003)>', '   =2003A&A...411..361K', '='.repeat(80)].join('\n');

/** An archive that answers each request by the first rule whose words its URL and query hold. */
const answering = (rules: readonly (readonly [string, string])[]): Archive & { readonly asked: string[] } => {
  const asked: string[] = [];
  return { asked, bytes: async () => Buffer.alloc(0), exists: async () => true,
    text: async (url, form) => { const request = `${decodeURIComponent(url)} ${form?.QUERY ?? ''} ${form?.['-source'] ?? ''}`; asked.push(request); const rule = rules.find(([words]) => request.includes(words)); if (!rule) throw new Error(`The test archive has no answer for ${request}`); return rule[1]; } };
};

test('VizieR\'s table metadata is read for the columns a placed star needs, by UCD and, without one, by name', () => {
  const gerke = parseVizierMeta(gerkeMeta, GERKE)!;
  assert.deepEqual([gerke.name, gerke.tables.length, gerke.tables[0]!.rows, gerke.tables[0]!.columns.length], [GERKE, 1, 126, 8]);
  assert.deepEqual(starColumns(gerke.tables[0]!), { identifier: 'M81C', period: { column: 'Per', log: false }, position: true }, 'the cross-identification F94 is not the star\'s own name');
  // A catalogue of two tables, asked by bibcode: its title and paper come with it. The older table has no UCDs.
  const gieren = parseVizierMeta(['#RESOURCE=yCat_51281167', '#Name: J/AJ/128/1167', '#Title: ARAUCARIA project : NGC 300 Cepheid Variables. II (Gieren+, 2004)', '#INFO\tcites=bibcode:2004AJ....128.1167G\t    Article or Data origin sources',
    '#Table\tyCat_51281167_1:', '#Name: J/AJ/128/1167/table1', '#Title:', '#INFO\tnrows=64\tNumber of rows of the table', RECNO, column('[PGF2002]', 'a6', 'Cepheid number'), column('Per', 'F7.3', 'Period'), column('logPer', 'F7.4', 'Log of the period'), column('Rem', 'a30', 'Remarks'),
    column('_RA', 'F8.4', 'Position from Paper I (J/AJ/123/789) (right ascension part)', 'pos.eq.ra;meta.main'), '#Table\tyCat_51281167_2:', '#Name: J/AJ/128/1167/table2', '#Title:', '#INFO\tnrows=3042\tNumber of rows of the table', RECNO,
    column('[PGF2002]', 'a6', 'Cepheid number'), column('HJD', 'F14.6', 'Heliocentric Julian Date')].join('\n'), '2004AJ....128.1167G')!;
  assert.deepEqual([gieren.name, gieren.bibcode, gieren.title, gieren.tables.map(table => [table.name, table.rows])], ['J/AJ/128/1167', '2004AJ....128.1167G', 'ARAUCARIA project : NGC 300 Cepheid Variables. II (Gieren+, 2004)', [['J/AJ/128/1167/table1', 64], ['J/AJ/128/1167/table2', 3042]]]);
  assert.deepEqual(starColumns(gieren.tables[0]!), { identifier: '[PGF2002]', period: { column: 'Per', log: false }, position: true }, 'the plain period is read before its logarithm; the leading text column names the star, a later one is a remark');
  assert.equal(starColumns(gieren.tables[1]!).period, undefined);
  assert.deepEqual(starColumns(parseVizierMeta(kanburMeta, KANBUR)!.tables[0]!), { identifier: 'Galaxy', period: { column: 'log(P)', log: true }, simbadName: 'SName', position: true }, 'the CDS link column "Simbad" is not the name column');
  assert.equal(parseVizierMeta('#INFO\tError=Table or Catalog not found: 1996ApJ...464..568F\t\n', '1996ApJ...464..568F'), undefined);
  assert.throws(() => parseVizierMeta('#INFO\tError=Too many requests\t\n', 'x'), /VizieR x: Too many requests/u);
  assert.throws(() => parseVizierMeta('#\n', 'x'), /VizieR x: the answer names no table/u);
});

test('a VizieR answer\'s rows are read under its rule, and a catalogue\'s paper from the head of its ReadMe', () => {
  assert.deepEqual(vizierDataRows(gerkeRows, GERKE)[2], { _RAJ2000: '149.0442500', _DEJ2000: '+69.1257500', M81C: '095610.62+690732.7', f_M81C: '', Per: '64.823', Vmag: '22.03', F94: 'C26', _RA: '149.04425', _DE: '+69.12575' });
  assert.deepEqual(vizierDataRows('#c\n\nID\tPer\n\n--\t---\nA\t1.5\n\n', 't'), [{ ID: 'A', Per: '1.5' }], 'a units line with no unit is blank');
  assert.throws(() => vizierDataRows('#INFO\tError=Table or Catalog not found: t\t\n', 't'), /VizieR t: Table or Catalog not found/u);
  assert.deepEqual(parseVizierReadMe(gerkeReadMe, 'J/ApJ/743/176'), { bibcode: '2011ApJ...743..176G', title: 'A study of Cepheids in M81 with the Large Binocular Telescope (efficiently calibrated with Hubble Space Telescope).', authors: ['Gerke', 'Kochanek', 'Prieto', 'Stanek', 'Macri'] });
  assert.deepEqual(parseVizierReadMe(gerkeReadMe.replace('    Gerke J.R., Kochanek C.S., Prieto J.L., Stanek K.Z., Macri L.M.', '    Fiorentino G., Contreras Ramos R.,\n    van den Bergh S.'), 'x').authors, ['Fiorentino', 'Contreras Ramos', 'van den Bergh']);
  assert.throws(() => parseVizierReadMe('no head', 'J/X/1/2'), /https:\/\/cdsarc\.cds\.unistra\.fr\/ftp\/J\/X\/1\/2\/ReadMe: its head names no paper/u);
  assert.deepEqual([catalogueOf(KANBUR), vizierReadMeUrl('J/A+A/411/361')], ['J/A+A/411/361', 'https://cdsarc.cds.unistra.fr/ftp/J/A+A/411/361/ReadMe']);
  assert.deepEqual(bibcodeReference('2012A&A...539A.138F'), { year: '2012', reference: 'A&A 539, A138' });
  assert.deepEqual(bibcodeReference('2019MNRAS.484L..24S'), { year: '2019', reference: 'MNRAS 484, L24' });
  assert.deepEqual([paperCredit(['Leonard'], '2003ApJ...594..247L').credit, paperCredit(['Bonanos', 'Stanek'], '2003ApJ...591L.111B').credit, paperCredit(['Gerke', 'Kochanek', 'Prieto'], '2011ApJ...743..176G')],
    ['Leonard (2003), ApJ 594, 247', 'Bonanos & Stanek (2003), ApJ 591, L111', { authors: 'Gerke et al. (2011)', credit: 'Gerke et al. (2011), ApJ 743, 176' }]);
  assert.throws(() => paperCredit([], '2011ApJ...743..176G'), /no author is named/u);
});

test('a request names a class, a galaxy, a table and the rows; each row drafted is given the fewest cells that pick it again', () => {
  assert.deepEqual(parseTableRequest('cepheid:m81=J/ApJ/743/176/table1'), { starClass: 'cepheid', galaxy: 'm81', table: GERKE, all: false, filters: {} });
  assert.deepEqual(parseTableRequest('cepheid:m95=J/A+A/411/361/table1#Galaxy=NGC3351,C2'), { starClass: 'cepheid', galaxy: 'm95', table: KANBUR, all: false, named: 'C2', filters: { Galaxy: 'NGC3351' } });
  assert.equal(parseTableRequest('cepheid:ngc-300=J/AJ/128/1167/table1#all').all, true);
  assert.throws(() => parseTableRequest('m81=J/ApJ/743/176/table1'), /is not CLASS:GALAXY=TABLE\[#ROW\] \(cepheid:m81=J\/ApJ\/743\/176\/table1\); the classes are cepheid/u);
  assert.throws(() => parseTableRequest('mira:m81=J/ApJ/743/176/table1'), /no class mira; the classes are cepheid/u);
  assert.throws(() => parseTableRequest('cepheid:m81=J/ApJ/743/176/table1#A,B'), /ROW names one star \(A, B are 2\)/u);
  const period = (cells: Readonly<Record<string, string>>) => Number(cells.Per), request = (row = '') => parseTableRequest(`cepheid:m81=${GERKE}${row}`), gerke = vizierDataRows(gerkeRows, GERKE), columns = starColumns(parseVizierMeta(gerkeMeta, GERKE)!.tables[0]!);
  // No row asked: one star, the longest period the relation covers (80 d is beyond its 68.464 d sample).
  assert.deepEqual(pickRows(gerke, columns, request(), ['M81'], period, 68.464).rows.map(row => row.key), [{ M81C: '095610.62+690732.7' }]);
  assert.deepEqual(pickRows(gerke, columns, request('#095614.95+690141.0'), ['M81'], period, 68.464).rows.map(row => [row.key, row.cells.Per]), [[{ M81C: '095614.95+690141.0' }, '10.241']]);
  assert.equal(pickRows(gerke, columns, request('#all'), ['M81'], period, 68.464).rows.length, 4);
  assert.deepEqual(pickRows(gerke, columns, request('#f_M81C=OU'), ['M81'], period, 68.464).rows.map(row => row.key), [{ f_M81C: 'OU' }], 'cells that pick one row are its key as given');
  assert.throws(() => pickRows(gerke, columns, request('#Nope=1'), ['M81'], period, 68.464), /has no column Nope; its columns are M81C, f_M81C, Per, Vmag, F94/u);
  assert.throws(() => pickRows(gerke, columns, request('#Per=9'), ['M81'], period, 68.464), /no row has Per = 9; cells are compared as VizieR writes them/u);
  assert.throws(() => pickRows(gerke, columns, request('#X1'), ['M81'], period, 68.464), /M81C = X1 matches 0 rows, not one/u);
  assert.throws(() => pickRows(gerke, columns, request(), ['M81'], period, 5), /none of its 4 rows has a period within the 5 d the relation covers/u);
  // A table of several galaxies is narrowed by the column that holds this galaxy's name, and a row is then named within it.
  const kanbur = vizierDataRows(kanburRows, KANBUR), kanburColumns = starColumns(parseVizierMeta(kanburMeta, KANBUR)!.tables[0]!), log = (cells: Readonly<Record<string, string>>) => Number((10 ** Number(cells['log(P)'])).toPrecision(4));
  const m95 = pickRows(kanbur, kanburColumns, parseTableRequest(`cepheid:m95=${KANBUR}`), ['M95', 'NGC 3351'], log, 68.464);
  assert.deepEqual([m95.named, m95.kept.length, m95.rows.map(row => row.key)], ['Cepheid', 2, [{ Galaxy: 'NGC3351', Cepheid: 'C1' }]]);
  assert.deepEqual(pickRows(kanbur, kanburColumns, parseTableRequest(`cepheid:m100=${KANBUR}`), ['M100', 'NGC 4321'], log, 68.464).rows.map(row => row.key), [{ Galaxy: 'NGC4321', Cepheid: 'C3' }], 'C2 pulsates in 76 d, beyond the relation');
  // A table that names no star: the row is picked by its period, and by the cells after it when periods repeat.
  const unnamed = [{ Per: '6.777', Xpix: '755.48', Comm: '' }, { Per: '6.777', Xpix: '1179.80', Comm: '' }, { Per: '7.943', Xpix: '365.66', Comm: 'blend' }];
  assert.deepEqual(pickRows(unnamed, { period: { column: 'Per', log: false }, position: true }, request('#all'), ['M83'], period, 68.464).rows.map(row => row.key), [{ Per: '6.777', Xpix: '755.48' }, { Per: '6.777', Xpix: '1179.80' }, { Per: '7.943' }]);
});

test('a star is placed where its sight line crosses its galaxy\'s drawn disc, and refused outside the radius the package frames', async () => {
  const m81 = await readGalaxy(root, 'm81');
  assert.deepEqual([m81.name, m81.reader, m81.recipePath], ['M81', 'the galaxy M81', 'src/objects/m81-layers/source/recipe.json']);
  const centre = placeInGalaxy(m81, m81.recipe.target.centerRaDeg, m81.recipe.target.centerDecDeg, 'centre');
  assert.equal(centre.value, Math.round(m81.recipe.target.distancePc));
  assert.match(centre.source, /^Placed in M81 as the app draws it, where the star's sight line crosses the disc's midplane: [\d,]+ pc \(src\/objects\/m81-layers\/source\/recipe\.json: centre [\d,]+ pc, inclination [\d.]+ deg, line of nodes [\d.]+ deg\)\. The galaxy's distance, which places the galaxy and not a star within it: /u);
  assert.match(centre.url, /^https:\/\//u);
  // M95 is two degrees from M96 on the sky: a star of M96 never sits in M95's disc.
  const m95 = await readGalaxy(root, 'm95');
  assert.throws(() => placeInGalaxy(m95, 161.69, 11.82, 'a star of M96'), /a star of M96: its sight line (?:never meets the disc|meets the disc [\d,]+ pc from the centre), outside the [\d,]+ pc src\/objects\/m95\/object\.json frames \(worldFrame\.bodyRadiusM\); the star is not in M95 as drawn/u);
  await assert.rejects(readGalaxy(root, 'sun'), /sun: packages\/astronomy\/data\/bodies\/sun\.json classification is "star", not "galaxy"/u);
  await assert.rejects(readGalaxy(root, 'no-such-galaxy'), /no astronomy record packages\/astronomy\/data\/bodies\/no-such-galaxy\.json/u);
});

test('a table with a position per star drafts a spec placed by its row, named as SIMBAD names the star', async () => {
  const archive = answering([['-meta.all', gerkeMeta], ['/ReadMe', gerkeReadMe], ['rvz_radvel', 'rvz_radvel,rvz_err,rvz_bibcode\n-47.0,0.1,"2022ApJS..261....6K"\n'],
    ['DISTANCE(POINT', 'main_id\totype\tseparation\n"[GKP2011] M81C J095610.62+690732.7"\t"Ce*"\t0.00001\n'], ['SELECT a.id FROM ident', 'id\n"[GKP2011] M81C J095610.62+690732.7"\n'], [GERKE, gerkeRows]]);
  const { stars, report } = await draftsFromTable([`cepheid:m81=${GERKE}`], archive, root), spec = parseStarSpec(stars[0]);
  assert.deepEqual(report, ['cepheid:m81=J/ApJ/743/176/table1: 1 Cepheid of Gerke et al. (2011), ApJ 743, 176 in M81; radius and temperature from Groenewegen (2020), A&A 635, A33\'s period relations.']);
  assert.deepEqual([spec.id, spec.name, spec.parent, spec.target], ['gkp2011-m81c-j095610-62-690732-7', '[GKP2011] M81C J095610.62+690732.7', 'm81', '[GKP2011] M81C J095610.62+690732.7']);
  assert.deepEqual(spec.position, { catalogue: GERKE, row: { M81C: '095610.62+690732.7' }, columns: { ra: '_RAJ2000', dec: '_DEJ2000' }, credit: 'Gerke et al. (2011), ApJ 743, 176', url: 'https://ui.adsabs.harvard.edu/abs/2011ApJ...743..176G' });
  assert.deepEqual([spec.paper, spec.mass, spec.radialVelocity?.value], [{ url: 'https://ui.adsabs.harvard.edu/abs/2011ApJ...743..176G', credit: 'Gerke et al. (2011), ApJ 743, 176' }, 'unmeasured', -47]);
  assert.ok(Math.abs(spec.distance!.value - 3622342) < 2, 'on the midplane of the disc M81 is drawn as, 8 kpc behind its centre');
  assert.match(spec.radius === 'gaia-flame' ? '' : spec.radius.source, /this star's period, 64\.823 d in Gerke et al\. \(2011\), ApJ 743, 176, VizieR J\/ApJ\/743\/176\/table1 M81C = 095610\.62\+690732\.7 \(Per\); not a measurement of this star/u);
  assert.deepEqual(spec.text, { card: 'A Cepheid in the galaxy M81, 3.6 million parsecs away, that swells and shrinks every 64.8 days.', introduction: 'Gerke et al. (2011) list its pulsation at 64.8 days.', locator: 'VizieR J/ApJ/743/176/table1 M81C = 095610.62+690732.7: Per' });
  // The generator reads the same row again by its key, at VizieR's own decimal position.
  assert.deepEqual(catalogueRowForm(spec.position!), { '-source': GERKE, '-out.all': '', '-out.max': '2', '-out.add': '_RAJ2000,_DEJ2000', M81C: '095610.62+690732.7' });
  const row = parseCatalogueRow([...gerkeRows.split('\n').slice(0, 3), gerkeRows.split('\n')[5]!].join('\n'), spec.position!, 'test');
  assert.deepEqual([row.ra, row.dec, row.columns, row.archive, row.words], [149.04425, 69.12575, { ra: '_RAJ2000', dec: '_DEJ2000' }, 'VizieR', 'J/ApJ/743/176/table1 row M81C = 095610.62+690732.7']);
  assert.equal(catalogueRowUrl(spec.position!), VIZIER_ASU);
  // A star SIMBAD does not list takes the name its table writes, in its galaxy.
  const unlisted = answering([['-meta.all', gerkeMeta], ['/ReadMe', gerkeReadMe], ['rvz_radvel', 'rvz_radvel,rvz_err,rvz_bibcode\n-47.0,0.1,"2022ApJS..261....6K"\n'], ['DISTANCE(POINT', 'main_id\totype\tseparation\n'], [GERKE, gerkeRows]]);
  assert.equal(parseStarSpec((await draftsFromTable([`cepheid:m81=${GERKE}#095614.95+690141.0`], unlisted, root)).stars[0]).name, 'M81 Cepheid 095614.95+690141.0');
  await assert.rejects(draftsFromTable([`cepheid:m81=${GERKE}`], answering([['-meta.all', '#INFO\tError=Table or Catalog not found: x\t\n']]), root), /VizieR holds no table J\/ApJ\/743\/176\/table1; `telescope stars m81` lists the tables/u);
});

test('a table that gives every row its galaxy\'s centre places its stars by the SIMBAD name of each row', async () => {
  const archive = answering([['-meta.all', kanburMeta], ['/ReadMe', kanburReadMe], ['rvz_radvel', 'rvz_radvel,rvz_err,rvz_bibcode\n779.0,3.0,"2022ApJS..261...21Y"\n'],
    ["n.id = '[GPF97] c1'", 'main_id\tra\tdec\tcoo_bibcode\n"[GPF97] c01"\t160.97075\t11.687527777777778\t\n'], ['SELECT a.id FROM ident', 'id\n"[GPF97] c01"\n'], [KANBUR, kanburRows]]);
  const { stars, report } = await draftsFromTable([`cepheid:m95=${KANBUR}`], archive, root), spec = parseStarSpec(stars[0]);
  assert.match(report[0]!, /1 Cepheid of Kanbur et al\. \(2003\), A&A 411, 361 in M95, placed by SIMBAD;/u);
  assert.deepEqual([spec.id, spec.name, spec.parent], ['gpf97-c01', '[GPF97] c01', 'm95']);
  assert.deepEqual(spec.position, { archive: 'simbad', catalogue: 'basic', row: { main_id: '[GPF97] c01' }, url: 'https://simbad.cds.unistra.fr/simbad/sim-id?Ident=%5BGPF97%5D%20c01',
    credit: 'Kanbur et al. (2003), A&A 411, 361, VizieR J/A+A/411/361/table1 Galaxy = NGC3351, Cepheid = C1, names the star in SIMBAD (SName); SIMBAD holds its position and names no paper for it' });
  assert.match(spec.radius === 'gaia-flame' ? '' : spec.radius.source, /this star's period, 42\.95 d in Kanbur et al\. \(2003\), A&A 411, 361, VizieR J\/A\+A\/411\/361\/table1 Galaxy = NGC3351, Cepheid = C1 \(log\(P\) 1\.633\)/u);
  assert.ok(!archive.asked.some(request => request.includes('DISTANCE(POINT')), 'the star is named by its row, not looked for at the galaxy\'s centre');
  // The generator asks SIMBAD for that object's own row, and a manifest records SIMBAD as its archive.
  assert.equal(catalogueRowUrl(spec.position!), SIMBAD_TAP);
  assert.deepEqual(catalogueRowForm(spec.position!), { REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'tsv', QUERY: "SELECT main_id, ra, dec, coo_bibcode FROM basic WHERE main_id = '[GPF97] c01'" });
  const row = parseCatalogueRow('main_id\tra\tdec\tcoo_bibcode\n"[GPF97] c01"\t160.97075\t11.687527777777778\t\n', spec.position!, 'test');
  assert.deepEqual([row.ra, row.dec, row.columns, row.archive, row.words, row.epoch], [160.97075, 11.687527777777778, { ra: 'ra', dec: 'dec' }, 'SIMBAD', 'basic row main_id = [GPF97] c01', 2000]);
  assert.deepEqual(rowArchive(row), { origin: SIMBAD_TAP, credit: 'SIMBAD (CDS; Wenger et al. 2000, A&AS 143, 9)', license: 'CDS SIMBAD database: free use with acknowledgement', licenseEvidence: ['https://cds.unistra.fr/help/acknowledgement/'],
    page: 'https://simbad.cds.unistra.fr/simbad/sim-id?Ident=%5BGPF97%5D%20c01', acquisition: 'SIMBAD TAP query in source/preparation/acquisition.json: basic row main_id = [GPF97] c01, its position and the paper SIMBAD names for it.' });
  assert.throws(() => parseCatalogueRow('main_id\tra\tdec\tcoo_bibcode\n', spec.position!, 'test'), /test: SIMBAD basic row main_id = \[GPF97\] c01 matches 0 rows, not one; main_id is the name as SIMBAD writes it, spaces included/u);
  assert.deepEqual(citedRow('Kanbur et al. (2003) (https://x), SIMBAD basic row main_id = [GPF97] c01: ra 160.97075, dec 11.68'), { table: 'basic', key: 'main_id = [GPF97] c01' }, 'a second package for the same SIMBAD object is a duplicate');
  assert.throws(() => parseStarSpec({ ...stars[0] as object, position: { ...spec.position, catalogue: 'J/A+A/411/361/table1' } }), /a SIMBAD position is \{ "archive": "simbad", "catalogue": "basic", "row": \{ "main_id": NAME \} \}, with no columns or motion/u);
  assert.throws(() => parseStarSpec({ ...stars[0] as object, position: { ...spec.position, archive: 'ned' } }), /position\.archive is "simbad" or absent \(a VizieR table\), not "ned"/u);
  // SIMBAD does not know the name the table gives: the row cannot be placed.
  const unknown = answering([['-meta.all', kanburMeta], ['/ReadMe', kanburReadMe], ['rvz_radvel', 'rvz_radvel,rvz_err,rvz_bibcode\n779.0,3.0,"2022ApJS..261...21Y"\n'], ["n.id = '[GPF97] c1'", 'main_id\tra\tdec\tcoo_bibcode\n'], [KANBUR, kanburRows]]);
  await assert.rejects(draftsFromTable([`cepheid:m95=${KANBUR}`], unknown, root), /Galaxy = NGC3351, Cepheid = C1: SIMBAD holds no position for SName = "\[GPF97\] c1", and the table gives the row none of its own/u);
});
