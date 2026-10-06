/** The star survey (stars.mts), offline. The fixtures are every answer SIMBAD and VizieR served the survey for M95, M83 and M51 on
 * 2026-10-04, whole. M51 holds a supergiant SIMBAD types as a plain star (M51-DS1), which no class of the survey names. The papers
 * API's answers (OpenAlex) are cut: no work is kept for M95 and M83, and for M51 three of its 91, without their author lists; each is filed
 * under the request the survey makes now, which asks the same question with more spellings and fields than the one that was answered. M95's Cepheids come from a paper VizieR does not hold and from a reanalysis whose
 * table gives every row its galaxy's centre and the star's SIMBAD name; M83's have a table with a position per star. */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { WORKSPACE } from '@cssearth/telescope/node';
import { parseCli } from '../cli-arguments.mts';
import { loadTargetCatalogue } from '../observation-query/query.mts';
import { parseSimbadTsv } from '../new-object/archives/tables/simbad-tap.mts';
import { spellings } from '../papers/names.mts';
import { openAlexQuery } from '../papers/works.mts';
import { formatStars, parseSimbadTypes, simbadQueries, STAR_WORDS, STARS_SCHEMA, surveyStars, typesUnder } from './stars.mts';

interface Served { readonly url: string; readonly body: string }
// Read once: the catalogue is every object package's descriptor.
const catalogue = await loadTargetCatalogue(WORKSPACE);
const served = async (galaxy: string): Promise<Served[]> => JSON.parse(await readFile(resolve(import.meta.dirname, `../fixtures/telescope-stars/served-${galaxy}.json`), 'utf8')) as Served[];
/** Answers each recorded request once, by its URL; any other request fails the test. */
const answering = (answers: readonly Served[], replace: (url: string, body: string) => string = (_url, body) => body) => (async (url: string | URL | Request) => {
  const answer = answers.find(entry => entry.url === String(url));
  if (!answer) throw new Error(`The survey asked for a URL the fixture does not hold: ${String(url)}`);
  return new Response(replace(answer.url, answer.body), { status: 200 });
}) as typeof fetch;

test('SIMBAD\'s answers are read by column, and a star class is a branch of its type tree', async () => {
  assert.deepEqual(parseSimbadTsv('main_id\tra\n"M  95"\t160.99\n"a ""b"""\t1\n', 'q'), [{ main_id: 'M  95', ra: '160.99' }, { main_id: 'a "b"', ra: '1' }]);
  assert.throws(() => parseSimbadTsv('<?xml version="1.0"?><VOTABLE><INFO name="QUERY_STATUS" value="ERROR">Incorrect ADQL query</INFO></VOTABLE>', 'SELECT x'), /SIMBAD refused the query \(Incorrect ADQL query\): SELECT x/u);
  const types = parseSimbadTypes(parseSimbadTsv((await served('m95'))[1]!.body, 'types'));
  assert.deepEqual(typesUnder(types, ['Ce*']).sort(), ['Ce*', 'cC*'], 'a classical Cepheid is a Cepheid; candidates are left out');
  assert.ok(typesUnder(types, ['sg*']).includes('WR*'), 'SIMBAD puts the Wolf-Rayet stars on the supergiant branch');
  assert.ok(!typesUnder(types, ['Ce*']).includes('WV*'), 'a Type II Cepheid is on a branch of its own');
  assert.match(simbadQueries.galaxy("Barnard's Galaxy"), /n\.id = 'Barnard''s Galaxy'$/u);
});

test('a table that gives its stars a period and a SIMBAD name, and no place of their own, is a lead placed by SIMBAD', async () => {
  const result = await surveyStars(WORKSPACE, { target: 'm95', catalogue, fetcher: answering(await served('m95')) }), cepheids = result.classes[0]!;
  assert.deepEqual([result.schema, result.target, result.simbad.name, result.simbad.majorAxisArcmin], [STARS_SCHEMA, { id: 'm95', name: 'M95' }, 'M 95', 5.59651]);
  assert.deepEqual([result.objects, result.stars, cepheids.id, cepheids.count], [210, 72, 'cepheid', 48]);
  assert.deepEqual(cepheids.papers.map(paper => [paper.bibcode, paper.stars, paper.catalogue?.name ?? null]),
    [['1997ApJ...477..535G', 48, null], ['2003A&A...411..361K', 47, 'J/A+A/411/361/table1'], ['1997ApJ...491...13K', 4, null]]);
  assert.equal(cepheids.papers[1]!.url, 'https://ui.adsabs.harvard.edu/abs/2003A%26A...411..361K');
  const [reanalysis] = cepheids.papers[1]!.catalogue!.tables;
  assert.deepEqual([reanalysis!.rows, reanalysis!.columns.period, reanalysis!.columns.position, reanalysis!.ownPositions], [725, { column: 'log(P)', log: true }, true, false],
    'the table has a position column, and its rows all repeat one: the galaxy\'s centre');
  assert.deepEqual(result.leads, [{ class: 'cepheid', bibcode: '2003A&A...411..361K', table: 'J/A+A/411/361/table1', positions: 'simbad', command: 'telescope new-object --from-table cepheid:m95=J/A+A/411/361/table1 --out SPEC.json' }]);
  assert.deepEqual(result.transients.filter(kind => kind.count).map(kind => [kind.label, kind.count]), [['supernovae', 1], ['planetary nebulae', 15]]);
  const text = formatStars(result);
  assert.match(text, /^M95 · 72 stars among 210 SIMBAD objects within 5\.6′ of M 95\n/u);
  assert.match(text, /\n {5}48 {2}1997ApJ\.\.\.477\.\.535G {2}The Hubble Space Telescope extragalactic distance scale key project\. VII\.[^\n]*\n {9}VizieR holds no table of this paper\.\n/u);
  assert.match(text, /VizieR J\/A\+A\/411\/361\/table1: 725 rows, period \(log\(P\)\), one position for every row, not each star's, a SIMBAD name per row \(SName\)\n/u);
  assert.match(text, /\nNot stars to place: 1 supernova, 15 planetary nebulae\.\n/u);
  assert.match(text, /\nReady, placed by SIMBAD \(the table gives each row a SIMBAD name and no position\): telescope new-object --from-table cepheid:m95=J\/A\+A\/411\/361\/table1 --out SPEC\.json\n/u);
  assert.equal(reanalysis!.columns.simbadName, 'SName');
  assert.doesNotMatch(text, /\nReady:/u);
});

test('a table with a period and a position per star is a ready lead, for a class the generator drafts', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'cssearth-stars-'));
  try {
    const result = await surveyStars(WORKSPACE, { target: 'M83', catalogue, directory, fetcher: answering(await served('m83')) });
    assert.deepEqual(result.classes.map(starClass => [starClass.id, starClass.count]), [['cepheid', 109], ['type-ii-cepheid', 0], ['rr-lyrae', 0], ['long-period', 52], ['supergiant', 74]]);
    const table = result.classes[0]!.papers[0]!.catalogue!.tables[0]!;
    assert.deepEqual([table.name, table.rows, table.columns.period, table.ownPositions], ['J/ApJ/591/L111/table1', 112, { column: 'Per', log: false }, true]);
    assert.equal(table.columns.identifier, undefined, 'the table names no star: a row is picked by its cells');
    // The long-period variables have a table with periods too, and no draft route: a lead is only for a class the generator drafts.
    assert.equal(result.classes[3]!.papers[0]!.catalogue!.tables[0]!.columns.period?.column, 'Per');
    assert.deepEqual(result.leads, [{ class: 'cepheid', bibcode: '2003ApJ...591L.111B', table: 'J/ApJ/591/L111/table1', positions: 'table', command: 'telescope new-object --from-table cepheid:m83=J/ApJ/591/L111/table1 --out SPEC.json' }]);
    assert.match(formatStars(result, directory), /\nReady: telescope new-object --from-table cepheid:m83=J\/ApJ\/591\/L111\/table1 --out SPEC\.json\n\nA lead is not a star: read the paper, and check a star is in the galaxy and not in front of it\.\n\nSaved: /u);
    assert.deepEqual(JSON.parse(await readFile(resolve(directory, 'stars.json'), 'utf8')), JSON.parse(JSON.stringify(result)));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a table that lists each star by its detector pixel is a lead that still needs its exposure', async () => {
  // M95's answers, with the reanalysis's table described as VizieR describes Gibson et al. (2000), J/ApJ/529/723/appen: a chip, X and Y, and no sky position.
  const column = (name: string, format: string, description: string, ucd: string) => `#Column\t${name}\t(${format})\t${description}\t[ucd=${ucd}]`;
  const pixels = ['#RESOURCE=yCat_15290723_1', '#Name: J/ApJ/529/723/appen', '#Title:', '#INFO\tnrows=232\tNumber of rows of the table', '#Table\t:', '#Name: J/ApJ/529/723/appen', '#Title:', column('Cluster', 'a9', 'Cluster name', 'meta.id.parent'),
    column('CNN', 'A3', 'Cepheid number in the cluster (1)', 'meta.id;meta.main'), column('Chip', 'I1', '? Chip number', 'meta.id;instr'), column('Xpos', 'F6.1', 'X pixel position', 'pos.cartesian.x;instr.det'),
    column('Ypos', 'F6.1', 'Y pixel position', 'pos.cartesian.y;instr.det'), column('Per', 'F5.2', 'TRIAL period', 'time.period')].join('\n');
  const result = await surveyStars(WORKSPACE, { target: 'm95', catalogue, fetcher: answering(await served('m95'), (url, body) => url.includes('-meta.all') && url.includes('2003A') ? pixels : body) });
  const table = result.classes[0]!.papers[1]!.catalogue!.tables[0]!;
  assert.deepEqual([table.columns.pixel, table.columns.position, table.ownPositions], [{ x: 'Xpos', y: 'Ypos', chip: 'Chip' }, false, false]);
  assert.deepEqual(result.leads, [{ class: 'cepheid', bibcode: '2003A&A...411..361K', table: 'J/ApJ/529/723/appen', positions: 'pixel', command: 'telescope new-object --from-table cepheid:m95=J/ApJ/529/723/appen#exposure=mast:HST/product/FILE.fits,firstPixel=N --out SPEC.json' }]);
  const text = formatStars(result);
  assert.match(text, /VizieR J\/ApJ\/529\/723\/appen: 232 rows, period \(Per\), no position, a detector pixel per star \(Chip, Xpos, Ypos\)\n/u);
  assert.match(text, /\nPlaced by pixel, once the paper says which exposure its pixels are of and how its software counts them \(FILE, N\): telescope new-object --from-table cepheid:m95=J\/ApJ\/529\/723\/appen#exposure=mast:HST\/product\/FILE\.fits,firstPixel=N --out SPEC\.json\n/u);
});

test('a single star of no class, with no parallax or proper motion in SIMBAD, is named as a lead for a spec written by hand', async () => {
  const result = await surveyStars(WORKSPACE, { target: 'm51', catalogue, fetcher: answering(await served('m51')) });
  assert.deepEqual(result.others, [{ name: 'EQ J132952.7+471036', otype: '*', papers: 7 }, { name: 'NAME M51-DS1', otype: '*', papers: 4 }, { name: 'EQ J1329+4710', otype: '*', papers: 2 }]);
  assert.deepEqual(result.leads, [], 'its long-period variable has a table, and no class the generator drafts');
  const text = formatStars(result);
  assert.match(text, /\nOther single stars SIMBAD holds here with no parallax or proper motion, most cited first: EQ J132952\.7\+471036 \(\*, 7 papers\); NAME M51-DS1 \(\*, 4 papers\); EQ J1329\+4710 \(\*, 2 papers\)\.\nOne whose paper prints a temperature and a luminosity can be drafted by hand \(spec\.mts\)\.\n/u);
  // The stars asked for are of no class above and no outburst or remnant: a Cepheid, a nova or an X-ray binary is counted where it belongs.
  const query = simbadQueries.others(202.47, 47.195, 0.1, ['*', 'Em*']);
  assert.match(query, /^SELECT TOP 8 b\.main_id, b\.otype, b\.nbref FROM basic AS b WHERE CONTAINS\(POINT\('ICRS', b\.ra, b\.dec\), CIRCLE\('ICRS', 202\.47, 47\.195, 0\.10000\)\) = 1 AND b\.plx_value IS NULL AND b\.pmra IS NULL AND b\.nbref >= 2 AND b\.otype IN \('\*', 'Em\*'\) ORDER BY nbref DESC$/u);
  // The papers API names the works that speak of the galaxy and a kind of star, whatever SIMBAD holds: here a Cepheid paper SIMBAD's stars do not
  // cite and the paper of M51-DS1 itself. A title that only says "massive star clusters" is named too: the reader judges.
  assert.deepEqual(result.works.map(work => [work.year, work.title.slice(0, 44), work.doi]), [
    [2025, 'Detecting the Black Hole Candidate Populatio', 'https://doi.org/10.3847/1538-4357/ad9d37'],
    [2023, 'Reeling in the Whirlpool galaxy: Distance to', 'https://doi.org/10.1051/0004-6361/202346971'],
    [2022, 'An Exceptional Dimming Event for a Massive, ', 'https://doi.org/10.3847/1538-4357/ac626c']]);
  assert.match(text, /\nWorks that name it with a kind of star \(papers API\), the star in the title first, each newest first:\n {2}2025 {2}Detecting[^\n]+\n {2}2023 {2}Reeling in the Whirlpool galaxy: Distance to M 51 clarified through Cepheids[^\n]+\n {2}2022 {2}An Exceptional Dimming Event for a Massive, Cool Supergiant in M51 {2}https:\/\/doi\.org\/10\.3847\/1538-4357\/ac626c\n/u);
  assert.deepEqual(spellings(['M61', 'NGC 4303', 'Messier 61', 'Swelling Spiral']), ['M 61', 'M61', 'NGC 4303', 'NGC4303', 'Messier 61', 'Messier61', 'Swelling Spiral'], 'a paper writes a catalogue name with or without its space');
  // The survey asks the question `telescope papers` asks, with the kinds of star as its subject.
  const asked = new URL(openAlexQuery({ names: spellings(['M61', 'NGC 4303']), about: STAR_WORDS, newestFirst: true })).searchParams;
  assert.match(asked.get('filter') ?? '', /^title_and_abstract\.search:\("M 61" OR "M61" OR "NGC 4303" OR "NGC4303"\) AND \("Cepheid" OR "Cepheids" OR "supergiant" OR [^)]+\),type:article\|review\|preprint\|letter$/u);
  assert.equal(asked.get('sort'), 'publication_year:desc');
  // When OpenAlex does not answer, arXiv is asked; when neither does, the survey still stands and says so.
  const answers = await served('m51'), failing = (async (url: string | URL | Request) => String(url).includes('api.openalex.org') ? new Response('slow down', { status: 429 })
    : String(url).includes('export.arxiv.org') ? new Response('', { status: 503 }) : answering(answers)(url)) as typeof fetch;
  const unanswered = await surveyStars(WORKSPACE, { target: 'm51', catalogue, fetcher: failing });
  assert.deepEqual([unanswered.works, unanswered.worksIssue, unanswered.others.length], [[], 'OpenAlex returned HTTP 429. arXiv returned HTTP 503.', 3]);
  assert.match(formatStars(unanswered), /\nThe papers API did not answer \(OpenAlex returned HTTP 429\. arXiv returned HTTP 503\.\); run `telescope papers` for it later\.\n/u);
  const feed = '<feed xmlns="http://www.w3.org/2005/Atom"><entry><id>http://arxiv.org/abs/2110.11376v2</id><title>An Exceptional Dimming Event for a Massive, Cool Supergiant in M51</title><summary>A star of M51.</summary><published>2021-10-21T00:00:00Z</published></entry></feed>';
  const fromArxiv = await surveyStars(WORKSPACE, { target: 'm51', catalogue, fetcher: (async (url: string | URL | Request) => String(url).includes('export.arxiv.org') ? new Response(feed) : failing(url)) as typeof fetch });
  assert.deepEqual([fromArxiv.works, fromArxiv.worksIssue], [[{ year: 2021, title: 'An Exceptional Dimming Event for a Massive, Cool Supergiant in M51', doi: null }], 'OpenAlex returned HTTP 429.']);
  assert.match(formatStars(fromArxiv), /\nWorks that name it with a kind of star \(papers API, from arXiv alone\), [^\n]+\n {2}2021 {2}An Exceptional[^\n]+\n\nOpenAlex did not answer \(OpenAlex returned HTTP 429\.\); run `telescope papers` for it later\.\n/u);
  // A galaxy with no such star says nothing of them.
  const none = await surveyStars(WORKSPACE, { target: 'm95', catalogue, fetcher: answering(await served('m95')) });
  assert.deepEqual([none.others, none.works], [[], []]); assert.doesNotMatch(formatStars(none), /Other single stars|Works that name it/u);
});

test('a target SIMBAD gives no outline is refused by the field that is empty, and the command line takes one galaxy', async () => {
  const answers = await served('m95');
  await assert.rejects(surveyStars(WORKSPACE, { target: 'm95', catalogue, fetcher: answering(answers, (url, body) => url === answers[0]!.url ? body.replace('\t5.59651', '\t') : body) }),
    /SIMBAD gives M {2}95 no outline \(basic\.galdim_majaxis is empty\), so the survey has no region to search/u);
  // Every name the catalogue has for the galaxy is tried before giving up.
  const asked: string[] = [], unknown = (async (url: string | URL | Request) => { asked.push(new URL(String(url)).searchParams.get('QUERY')!.split('n.id = ')[1]!); return new Response('main_id\tra\tdec\tgaldim_majaxis\n'); }) as typeof fetch;
  await assert.rejects(surveyStars(WORKSPACE, { target: 'm95', catalogue, fetcher: unknown }), /SIMBAD knows no object named M95 or /u);
  assert.equal(asked[0], "'M95'"); assert.ok(asked.length > 1);
  await assert.rejects(surveyStars(WORKSPACE, { target: 'm95', catalogue, fetcher: (async () => new Response('', { status: 503 })) as typeof fetch }), /SIMBAD returned HTTP 503 for https:\/\/simbad/u);
  assert.deepEqual(parseCli(['stars', 'm95', '--out', 'out', '--json']), { command: 'stars', target: 'm95', directory: resolve('out'), json: true, verbose: false });
  assert.throws(() => parseCli(['stars']), /Use telescope stars GALAXY \[--json\] \[--out DIRECTORY\]\./u);
  assert.throws(() => parseCli(['stars', 'm95', '--instrument', 'x']), /Unknown or repeated stars option --instrument\./u);
});
