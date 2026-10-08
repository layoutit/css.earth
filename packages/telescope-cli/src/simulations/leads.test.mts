/** Leads (leads.mts), offline: DataCite's two answers for GJ 1214 b as served on 2026-10-04, five data records and four
 * arXiv papers with the fields the parser reads (fixtures/telescope-simulations/datacite-gj-1214b.json). */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { WORKSPACE } from '@cssearth/telescope/node';
import { hostedOrbit, starAstrometry, type HostedPlanetId, type StarId } from '@cssearth/astronomy';
import { dataciteQuery, formatLeads, formatSurvey, leadFor, opensOn, parseDatacite, rankLeads, searchLeads, surveyLeads, type Lead } from './leads.mts';

const served = async () => JSON.parse(await readFile(resolve(import.meta.dirname, '../fixtures/telescope-simulations/datacite-gj-1214b.json'), 'utf8')) as { data: unknown; paper: unknown };
/** DataCite answering from the fixture: the data search by its resource types, the paper search by its arXiv client. */
const datacite = async (asked: string[] = []) => {
  const body = await served();
  return (async (url: unknown) => { asked.push(String(url)); return new Response(JSON.stringify(String(url).includes('client-id=arxiv.content') ? body.paper : body.data), { status: 200 }); }) as typeof fetch;
};
const record = (title: string, description = '', kind: Lead['kind'] = 'paper') => ({ doi: `10.0/${title.length}`, url: 'https://doi.org/10.0/x', kind, publisher: 'arXiv', year: 2024, title, description, license: null });

test('one search names every form of every name, in titles and descriptions, across repositories or among arXiv papers', () => {
  const data = new URL(dataciteQuery(['GJ 1214 b'], 'data')), paper = new URL(dataciteQuery(['GJ 1214 b'], 'paper', 2));
  assert.equal(data.origin + data.pathname, 'https://api.datacite.org/dois');
  assert.equal(data.searchParams.get('query'), 'titles.title:("GJ 1214b" OR "GJ1214b" OR "GJ 1214 b" OR "GJ1214 b") OR descriptions.description:("GJ 1214b" OR "GJ1214b" OR "GJ 1214 b" OR "GJ1214 b")');
  assert.equal(data.searchParams.get('resource-type-id'), 'dataset,model,software,collection,other,workflow,interactive-resource');
  assert.equal(data.searchParams.get('client-id'), null);
  assert.equal(paper.searchParams.get('client-id'), 'arxiv.content');
  assert.equal(paper.searchParams.get('page[number]'), '2');
  assert.match(paper.searchParams.get('query')!, /^\(titles\.title:\("GJ 1214b" OR "GJ1214b" OR "GJ 1214 b" OR "GJ1214 b"\) OR descriptions[^)]+\)\) AND \(titles\.title:\("phase curve" OR .*"climate model"\)\)$/u);
});

test('a record is a lead when it names the object and speaks of a map, an eclipse or a model; the title decides before the description', () => {
  const names = ['GJ 1214 b'], lead = (title: string, description = '') => leadFor(record(title, description), names);
  assert.deepEqual([lead('A reflective atmosphere for GJ 1214b from its JWST phase curve')?.class, lead('A reflective atmosphere for GJ 1214b from its JWST phase curve')?.inTitle], ['map', true]);
  assert.equal(lead('Spitzer secondary eclipses of GJ 1214 b')?.class, 'eclipse');
  assert.equal(lead('GCM simulations of GJ1214b')?.class, 'simulation', 'a catalogue number is also written without its space');
  // The title speaks of a model, the description of a phase curve: the title is what the work is.
  assert.equal(lead('A climate model of GJ 1214 b', 'We predict its phase curve.')?.class, 'simulation');
  // Named and classed only in the description: kept, and said to be so.
  assert.deepEqual([lead('Hazes on sub-Neptunes', 'We compare with the phase curve of GJ 1214 b.')?.class, lead('Hazes on sub-Neptunes', 'We compare with the phase curve of GJ 1214 b.')?.inTitle], ['map', false]);
  assert.equal(lead('The phase curve of GJ 436 b'), undefined, 'another planet');
  assert.equal(lead('The mass of GJ 1214 b from radial velocities'), undefined, 'nothing to draw');
});

test('leads are read in order: named in the title first, a measured map before an eclipse before a model, the newest first, one a title', () => {
  const names = ['GJ 1214 b'], make = (title: string, description: string, year: number, doi: string) => ({ ...leadFor(record(title, description), names)!, year, doi });
  const ranked = rankLeads([make('A climate model of GJ 1214 b', '', 2014, 'a'), make('Hazes', 'The phase curve of GJ 1214 b.', 2025, 'b'), make('Eclipses of GJ 1214 b: secondary eclipse', '', 2020, 'c'),
    make('The phase curve of GJ 1214 b', '', 2023, 'd'), make('The phase curve of GJ 1214 b', '', 2023, 'e'), make('Phase variations of GJ 1214 b', '', 2024, 'f')]);
  assert.deepEqual(ranked.map(lead => lead.doi), ['f', 'd', 'c', 'a', 'b']);
});

test('DataCite\'s answer is read as served: the repository, the year, the stated license, and a paper\'s abstract', async () => {
  const body = await served(), data = parseDatacite(body.data, 'data'), papers = parseDatacite(body.paper, 'paper');
  assert.deepEqual(data.records.map(lead => lead.publisher), ['Harvard Dataverse', 'University of Exeter', 'STScI/MAST', 'Zenodo', 'European Space Agency']);
  assert.deepEqual(data.records.map(lead => lead.license), ['cc0-1.0', 'cc-by-4.0', null, 'cc-by-4.0', null]);
  assert.equal(data.pages, 1);
  assert.deepEqual(papers.records.map(lead => [lead.doi, lead.publisher, lead.year]), [['10.48550/arxiv.2305.05697', 'arXiv', 2023], ['10.48550/arxiv.2305.06240', 'arXiv', 2023], ['10.48550/arxiv.2209.12205', 'arXiv', 2022], ['10.48550/arxiv.1401.1898', 'arXiv', 2014]]);
  assert.match(papers.records[1]!.description, /phase curve/u);
  assert.throws(() => parseDatacite({ data: [{ attributes: {} }] }, 'data'), /DataCite record 1\.attributes\.doi must be a DOI/u);
});

test('telescope leads OBJECT asks twice, keeps the records that are leads and saves them', async () => {
  const asked: string[] = [], directory = await mkdtemp(resolve(tmpdir(), 'leads-'));
  try {
    const result = await searchLeads(WORKSPACE, { target: 'gj-1214b', fetcher: await datacite(asked), wait: async () => {}, directory });
    assert.equal(asked.length, 2, 'the data releases, then the papers');
    assert.deepEqual(result.target, { id: 'gj-1214b', name: 'GJ 1214 b' });
    // The measured phase curve leads: the MAST data, the paper and the authors' release. The ESA proposal record is no lead.
    assert.deepEqual(result.leads.filter(lead => lead.inTitle).map(lead => [lead.class, lead.publisher, lead.year]),
      [['map', 'STScI/MAST', 2024], ['map', 'arXiv', 2023], ['map', 'Zenodo', 2023], ['simulation', 'arXiv', 2022], ['simulation', 'Harvard Dataverse', 2022], ['simulation', 'arXiv', 2014]]);
    assert.ok(!result.leads.some(lead => lead.publisher === 'European Space Agency'));
    const text = formatLeads(result, directory);
    assert.match(text, /^GJ 1214 b · \d+ leads in DataCite: data releases in every DOI repository, and arXiv papers\n\nPhase curve or map \(\d+\)\n {3}2024 · STScI\/MAST · license not stated to DataCite · JWST MIRI\/LRS phase curve of GJ 1214 b\n {5}https:\/\/doi\.org\/10\.17909\/qe3z-qj40\n/u);
    assert.match(text, /Published simulation \(\d+\)\n/u);
    assert.match(text, /A lead is read before anything is shown/u);
    assert.deepEqual((JSON.parse(await readFile(resolve(directory, 'leads.json'), 'utf8')) as { leads: unknown[] }).leads.length, result.leads.length);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a survey asks for every object of a class ten at a time, matches each record against all of them and puts the pages without a map first', async () => {
  const asked: string[] = [], waits: number[] = [], progress: string[] = [];
  // The whole class would be ninety groups: a server that answers the fixture once and nothing after stands in for it.
  const body = await served();
  let answered = 0;
  const fetcher = (async (url: unknown) => { asked.push(String(url)); const first = answered++ < 2; return new Response(JSON.stringify(first ? (String(url).includes('arxiv.content') ? body.paper : body.data) : { data: [], meta: { totalPages: 1 } }), { status: 200 }); }) as typeof fetch;
  const survey = await surveyLeads(WORKSPACE, { archiveClass: 'exoplanet', fetcher, wait: async ms => { waits.push(ms); }, progress: line => { progress.push(line); } });
  assert.equal(survey.requests, asked.length);
  assert.equal(asked.length, 2 * Math.ceil(survey.objects / 10), 'a data search and a paper search for every ten objects');
  assert.ok(waits.every(ms => ms === 400) && waits.length === asked.length - 1, 'every request after the first waits 400 ms');
  // The first group is not the one that holds GJ 1214 b: its records are matched against every planet all the same.
  const row = survey.rows.find(candidate => candidate.id === 'gj-1214b');
  assert.ok(row, 'GJ 1214 b has leads');
  assert.equal(row.leads[0]!.class, 'map');
  assert.equal(row.opensOn, await opensOn(WORKSPACE, 'gj-1214b'));
  assert.match(formatSurvey(survey), /^\d+ exoplanet objects asked in \d+ requests: \d+ have a lead, \d+ of them on a page that opens on no map\n/u);
  // A busy answer is asked for again twice, after 5 and 10 seconds, before the group is given up and named.
  const retried: number[] = [];
  const failing = await surveyLeads(WORKSPACE, { archiveClass: 'exoplanet', fetcher: (async () => new Response('', { status: 503 })) as typeof fetch, wait: async ms => { retried.push(ms); } });
  assert.deepEqual(retried.slice(0, 2), [5000, 10000]);
  assert.equal(failing.requests, 3 * 2 * Math.ceil(failing.objects / 10));
  assert.equal(failing.rows.length, 0);
  assert.match(failing.failures[0]!, /\(data\): DataCite returned HTTP 503 for a search of \d+ names \(data, page 1\)/u);
  assert.match(formatSurvey(failing), /Not asked: /u);
});

test('what a page opens on is read from its package: the default dataset\'s kind, and a map\'s format', async () => {
  assert.equal(await opensOn(WORKSPACE, 'trappist-1f'), 'neutral-shape');
  assert.equal(await opensOn(WORKSPACE, 'kelt-9b'), 'terrestrial-scientific:published-phase-curve-map');
  assert.equal(await opensOn(WORKSPACE, 'no-such-object'), undefined);
});

/** One time series of a planet's star, from the star's catalogue place at its own epoch, `orbits` of the planet long. */
const series = (star: StarId, planet: HostedPlanetId, orbits: number, startPhase = 0) => {
  const place = starAstrometry(star), orbit = hostedOrbit(planet), when = 51_544.5 + (place.positionEpochJulianYear - 2000) * 365.25, turns = Math.ceil((when - orbit.transitTimeBmjdTdb!) / orbit.periodDays);
  const start = orbit.transitTimeBmjdTdb! + (turns + startPhase) * orbit.periodDays;
  return { programme: '9999', instrument: 'MIRI', investigator: 'Someone', title: 'A time series', raDegrees: place.rightAscensionDegrees, decDegrees: place.declinationDegrees, startMjd: start, endMjd: start + orbits * orbit.periodDays, releaseMjd: 59_000 };
};
/** DataCite naming one arXiv paper, whatever is asked. */
const onePaper = (doi: string, title: string) => (async (url: unknown) => new Response(JSON.stringify(String(url).includes('arxiv.content') ? { data: [{ attributes: { doi, publicationYear: 2025, titles: [{ title }], descriptions: [] } }], meta: { totalPages: 1 } } : { data: [], meta: { totalPages: 1 } }), { status: 200 })) as typeof fetch;

test('a lead the page\'s ledger settles says so, and the archive\'s visits of the star are set beside the papers', async () => {
  const fetcher = onePaper('10.48550/arXiv.2512.05175', 'TESS phase curve of ultra-hot Jupiter WASP-189 b');
  const result = await searchLeads(WORKSPACE, { target: 'wasp-189b', fetcher, wait: async () => {}, timeSeries: async () => [series('wasp-189', 'wasp-189b', 0.2, 0.4)] });
  assert.deepEqual(result.leads.map(lead => lead.read), [{ status: 'excluded', entry: 'published-phase-curves' }]);
  assert.deepEqual(result.watched?.map(visit => [visit.part, visit.orbits]), [['eclipse', 0.2]]);
  const text = formatLeads(result);
  assert.match(text, /https:\/\/doi\.org\/10\.48550\/arXiv\.2512\.05175\n {5}already read: excluded in the page's ledger \(published-phase-curves\)\n/u);
  assert.match(text, /Watched by JWST \(1 visit of its star in MAST\)\n {3}\d{4}-\d\d-\d\d · MIRI · program 9999 \(Someone\) · [\d.]+ h, 0\.2 orbits from phase 0\.4 · eclipse(?: \(the recorded orbit[^)]*\))? · public\n {3}An eclipse is looked for half an orbit after transit/u);
  // Without the archive nothing is said of it, and an object that is not a planet with a transit has no visits to set.
  assert.equal((await searchLeads(WORKSPACE, { target: 'wasp-189b', fetcher, wait: async () => {} })).watched, undefined);
});

test('a survey leaves a settled lead out of the worklist and lists whole orbits watched and planets with no page', async () => {
  const unpaged = async (paged: readonly string[]) => { assert.ok(paged.includes('GJ 1214 b')); return { planets: [{ name: 'KELT-1 b', host: 'KELT-1', hostPaged: false, papers: [{ year: 2019, title: 'Spitzer Phase Curves of KELT-1b', url: 'https://doi.org/10.0/k' }], archiveEclipse: false },
    { name: 'TrES-2 b', host: 'TrES-2', hostPaged: false, papers: [], archiveEclipse: true }], requests: 4 }; };
  let asked = 0;
  const paper = onePaper('10.48550/arXiv.2512.05175', 'TESS phase curve of ultra-hot Jupiter WASP-189 b'), fetcher = (async (url: unknown) => { asked++; return paper(url as string); }) as typeof fetch;
  const survey = await surveyLeads(WORKSPACE, { archiveClass: 'exoplanet', fetcher, wait: async () => {}, timeSeries: async () => [series('trappist-1', 'trappist-1f', 1.2)], unpaged });
  assert.equal(survey.requests, asked + 1 + 4, 'DataCite, one request for the time series, and the unpaged search\'s own');
  assert.deepEqual(survey.rows.find(row => row.id === 'trappist-1f')?.watched?.map(visit => visit.part), ['whole-orbit']);
  assert.equal(survey.rows.find(row => row.id === 'trappist-1f')?.leads.length, 0, 'a row needs no paper');
  const text = formatSurvey(survey);
  assert.match(text, /Every lead already read in the page's ledger \(1\): WASP-189 b\n/u);
  assert.doesNotMatch(text, /Phase curve or map, named in a title/u, 'the one titled lead is settled');
  assert.match(text, /A whole orbit watched by JWST, page without a measured map \(\d+\)\n(?:.*\n)*? {3}TRAPPIST-1f \(neutral-shape\): MIRI 9999 public · no unread lead\n/u);
  assert.match(text, /No page yet, a phase curve or map named in a paper's title \(1\)\n {3}KELT-1 b \(star KELT-1, no page\): 2019 Spitzer Phase Curves of KELT-1b https:\/\/doi\.org\/10\.0\/k\n/u);
  assert.match(text, /No page yet, an eclipse in the NASA Exoplanet Archive's own tables \(1\): TrES-2 b\n/u);
  // A source that fails is named and the rest is still reported.
  const failed = await surveyLeads(WORKSPACE, { archiveClass: 'exoplanet', fetcher, wait: async () => {}, timeSeries: async () => { throw new Error('MAST is down'); } });
  assert.match(formatSurvey(failed), /Not asked: JWST time series: MAST is down/u);
});

test('a preprint is the journal article it is a version of: a ledger that cites either settles it, and a ledger that only includes it does not', async () => {
  const parsed = parseDatacite({ data: [{ attributes: { doi: '10.48550/arXiv.2201.04518', publicationYear: 2022, titles: [{ title: 'CHEOPS phase curve of WASP-189 b' }], descriptions: [],
    relatedIdentifiers: [{ relationType: 'IsVersionOf', relatedIdentifierType: 'DOI', relatedIdentifier: '10.1051/0004-6361/202142400' }, { relationType: 'Cites', relatedIdentifierType: 'DOI', relatedIdentifier: '10.0/other' }] } },
  { attributes: { doi: '10.26093/cds/vizier.36590074', publicationYear: 2022, titles: [{ title: 'CHEOPS phase curve of WASP-189 b' }], descriptions: [],
    relatedIdentifiers: [{ relationType: 'IsSupplementTo', relatedIdentifierType: 'DOI', relatedIdentifier: '10.1051/0004-6361/202142400' }] } }] }, 'paper');
  assert.deepEqual(parsed.records.map(found => found.sameAs), [['10.1051/0004-6361/202142400'], undefined], 'a data table that supplements a paper is another thing to read');
  // Papers come before the data released the same year.
  const names = ['WASP-189 b'], paper = { ...leadFor(parsed.records[0]!, names)!, kind: 'paper' as const }, data = { ...leadFor(parsed.records[1]!, names)!, kind: 'data' as const };
  assert.deepEqual(rankLeads([data, paper]).map(lead => lead.kind), ['paper', 'data']);
});
