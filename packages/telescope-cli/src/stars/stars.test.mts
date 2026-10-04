/** The star survey (stars.mts), offline. The fixtures are every answer SIMBAD and VizieR served the survey for M95 and M83 on
 * 2026-10-04, whole and in the order asked. M95's Cepheids come from a paper VizieR does not hold and from a reanalysis whose
 * table gives every row its galaxy's centre and the star's SIMBAD name; M83's have a table with a position per star. */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { WORKSPACE } from '@cssearth/telescope/node';
import { parseCli } from '../cli-arguments.mts';
import { loadTargetCatalogue } from '../query.mts';
import { parseSimbadTsv } from '../new-object/archives/simbad-tap.mts';
import { formatStars, parseSimbadTypes, simbadQueries, STARS_SCHEMA, surveyStars, typesUnder } from './stars.mts';

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
