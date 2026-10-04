import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { AR5IV_HTML, CAPTION_LIMIT, displayName, evidenceScore, extractCaptions, formatPapers, formatSweep, hostNames, isChallenge, relevantCaptions, searchPapers, sweepPapers } from './papers.mts';
import { sameTitleQuery, sameTitleWorks } from './papers/follow-ups.mts';
import { forms, spellings } from './papers/names.mts';
import { evidenceSentences, mentions } from './papers/text.mts';
import { abstractText, arxivIdOf, arxivQuery, citingQuery, openAlexQuery, parseArxivResponse, parseOpenAlexResponse, rankWorks } from './papers/works.mts';
import { parseCli } from './cli-arguments.mts';
import { WORKSPACE } from '@cssearth/telescope/node';

const fixtures = resolve(import.meta.dirname, 'fixtures/telescope-papers');
const openAlex = async (): Promise<unknown> => JSON.parse(await readFile(resolve(fixtures, 'openalex-works.json'), 'utf8'));

test('OpenAlex works are validated and reduced to the reported fields', async () => {
  const works = parseOpenAlexResponse(await openAlex());
  assert.equal(works.length, 4);
  const mura = works[1]!;
  assert.deepEqual(mura.authors, ['A. Mura', 'F. Zambon', 'F. Tosi']);
  assert.equal(mura.authorCount, 4);
  assert.equal(mura.licence, 'cc-by');
  assert.equal(mura.openAccessUrl, 'https://doi.org/10.3389/fspas.2024.1369472');
  assert.equal(mura.abstract, 'Juno/JIRAM mapped hotspots');
  assert.equal(works[0]!.openAccessUrl, null);
  assert.equal(works[3]!.openAccessUrl, 'https://arxiv.org/pdf/0000.00000');
  assert.deepEqual(works.map(work => [work.arxivId, work.retracted]), [[null, false], [null, false], [null, false], ['0000.00000', false]]);
});

test('malformed OpenAlex values are refused rather than trusted', () => {
  assert.throws(() => parseOpenAlexResponse({ results: 'none' }), /results must be an array/u);
  assert.throws(() => parseOpenAlexResponse({ error: 'Invalid query parameters' }), /OpenAlex refused/u);
  const work = { id: 'W', title: 'Io', open_access: { is_oa: 'yes', oa_url: null } };
  assert.throws(() => parseOpenAlexResponse({ results: [work] }), /is_oa must be a boolean/u);
  assert.throws(() => parseOpenAlexResponse({ results: [{ ...work, open_access: { is_oa: true, oa_url: null }, relevance_score: 'high' }] }), /relevance_score/u);
  assert.throws(() => abstractText({ Io: [-1] }), /small whole numbers/u);
});

test('works must name the target and instrument as whole words', async () => {
  const works = parseOpenAlexResponse(await openAlex()), kept = works.filter(work => mentions(work, ['Io', 'JIRAM']));
  assert.deepEqual(kept.map(work => work.id), ['https://openalex.org/W1', 'https://openalex.org/W2', 'https://openalex.org/W3']);
});

test('ranking puts open access first, then relevance, then recency, and keeps at most the limit', async () => {
  const works = parseOpenAlexResponse(await openAlex());
  assert.deepEqual(rankWorks(works, 20).map(work => work.id), ['https://openalex.org/W4', 'https://openalex.org/W2', 'https://openalex.org/W3', 'https://openalex.org/W1']);
  assert.equal(rankWorks(works, 2).length, 2);
});

test('the OpenAlex query searches title and abstract of papers only', () => {
  const url = new URL(openAlexQuery({ names: ['Io'], instrument: 'JIRAM' }));
  assert.equal(url.searchParams.get('filter'), 'title_and_abstract.search:"Io" AND "JIRAM",type:article|review|preprint|letter');
  assert.equal(url.searchParams.has('mailto'), false);
});

test('a target name with the OpenAlex wildcard is searched without it', () => {
  const url = new URL(openAlexQuery({ names: ['Sagittarius A*'] }));
  assert.equal(url.searchParams.get('filter'), 'title_and_abstract.search:"Sagittarius A",type:article|review|preprint|letter');
});

test('a temporary OpenAlex failure falls back to source-identified arXiv works within the same request budget', async () => {
  const feed = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><id>http://arxiv.org/abs/2609.12345v2</id>
    <title>Io JIRAM maps</title><summary>JIRAM mapped Io hotspots</summary><published>2026-09-20T00:00:00Z</published>
    <author><name>A. Researcher</name></author></entry></feed>`;
  const calls: string[] = [];
  const fetcher: typeof fetch = async input => {
    const url = String(input); calls.push(url);
    if (url.startsWith('https://api.openalex.org/')) return new Response('rate limited', { status: 429 });
    if (url.startsWith('https://export.arxiv.org/')) return new Response(feed, { headers: { 'content-type': 'application/atom+xml' } });
    if (url.startsWith('https://api.crossref.org/')) return Response.json({ message: { items: [] } });
    return new Response('%PDF', { headers: { 'content-type': 'application/pdf' } });
  };
  // A workspace holding Io's descriptor alone: the search reads every descriptor it finds, and the checkout has thousands.
  const workspace = await mkdtemp(resolve(tmpdir(), 'cssearth-papers-'));
  await mkdir(resolve(workspace, 'src/objects/io'), { recursive: true });
  await writeFile(resolve(workspace, 'src/objects/io/object.json'), await readFile(resolve(WORKSPACE, 'src/objects/io/object.json')));
  const result = await searchPapers(workspace, { target: 'Io', instrument: 'JIRAM', fetcher });
  assert.equal(result.source, 'arxiv'); assert.match(result.sourceIssue!, /429/u);
  // The arXiv PDF is not fetched to be discarded: its HTML rendering is asked for, then what else was published under the title.
  assert.equal(result.requests, 4); assert.equal(result.works[0]?.arxiv, 'https://arxiv.org/abs/2609.12345');
  assert.deepEqual(calls.slice(2), [`${AR5IV_HTML}/2609.12345`, sameTitleQuery('Io JIRAM maps')]);
  assert.equal(result.works[0]?.access.reason, 'arXiv holds the PDF of 2609.12345; ar5iv has no HTML rendering of it');
  assert.deepEqual(result.issues, ['Later works were not read: arXiv does not record which works cite a paper.']);
  assert.equal(result.works[0]?.openAlex, undefined); assert.equal(result.works[0]?.access.status, 'fetchable');
  assert.match(calls[1]!, /export\.arxiv\.org/u);
  assert.equal(new URL(arxivQuery({ names: ['Io'], instrument: 'JIRAM' })).searchParams.get('search_query'), 'all:"Io" AND all:"JIRAM"');
  assert.throws(() => parseArxivResponse('<html>not Atom</html>'), /Atom feed/u);
  await assert.rejects(searchPapers(workspace, { target: 'Io', fetcher: async () => new Response('', { status: 400 }) }), /OpenAlex returned HTTP 400/u);
  await rm(workspace, { recursive: true, force: true });
});

test('a hosted body is searched together with any one of its host names', () => {
  const url = new URL(openAlexQuery({ names: spellings(['S2']), hosts: ['Sagittarius A*', 'Sgr A*'] }));
  assert.equal(url.searchParams.get('filter'), 'title_and_abstract.search:("S 2" OR "S2") AND ("Sagittarius A" OR "Sgr A"),type:article|review|preprint|letter');
  const withInstrument = new URL(openAlexQuery({ names: ['S2'], instrument: 'GRAVITY', hosts: ['Sgr A*'] }));
  assert.equal(withInstrument.searchParams.get('filter'), 'title_and_abstract.search:"S2" AND "Sgr A" AND "GRAVITY",type:article|review|preprint|letter');
});

test('host names come from a body record with a hosted orbit, and only from one', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'papers-hosts-')), bodies = resolve(root, 'packages/astronomy/data/bodies');
  await mkdir(bodies, { recursive: true });
  await writeFile(resolve(bodies, 'star.json'), JSON.stringify({ physical: { parent: 'host' }, hostedOrbit: { periodDays: 1 } }));
  await writeFile(resolve(bodies, 'moon.json'), JSON.stringify({ physical: { parent: 'host' } }));
  await writeFile(resolve(bodies, 'lost.json'), JSON.stringify({ physical: { parent: 'missing' }, hostedOrbit: { periodDays: 1 } }));
  const catalogue = [{ id: 'host', name: 'Sagittarius A*', aliases: ['Sgr A*'] }];
  assert.deepEqual(await hostNames(root, 'star', catalogue), ['Sagittarius A*', 'Sgr A*']);
  assert.deepEqual(await hostNames(root, 'moon', catalogue), [], 'a moon keeps a plain search');
  assert.deepEqual(await hostNames(root, 'absent', catalogue), []);
  await assert.rejects(hostNames(root, 'lost', catalogue), /not in the target catalogue/u);
});

test('a name outside the catalogue is searched as written; a catalogue name still resolves', () => {
  const catalogue = [{ id: 'io', name: 'Io', aliases: [] }];
  assert.deepEqual(displayName('S301', catalogue), { id: 'S301', name: 'S301' });
  assert.deepEqual(displayName('io', catalogue), { id: 'io', name: 'Io' });
  assert.throws(() => displayName('  ', catalogue), /requires a target name/u);
});

test('captions and table titles are extracted verbatim with their labels', async () => {
  const { scanned, captions } = extractCaptions(await readFile(resolve(fixtures, 'article.html'), 'utf8'));
  assert.equal(scanned, 5, 'the outline copy of Table 1 is deduplicated and script state is ignored');
  assert.deepEqual(captions.map(caption => [caption.kind, caption.label]), [['table', 'Table 1'], ['figure', 'Figure 2'], ['figure', 'Figure 3'], ['table', 'Table 4'], ['figure', 'Figure 5']]);
  assert.equal(captions[1]!.text, '(A) Cylindrical equirectangular maps of the band radiance in the M filter for orbits 41 & 43.');
  assert.equal(captions[3]!.text.length, CAPTION_LIMIT);
  assert.ok(captions[3]!.text.endsWith('…'));
  assert.deepEqual(relevantCaptions(captions).map(caption => caption.label), ['Table 1', 'Figure 2', 'Table 4', 'Figure 5']);
});

test('browser challenges are recognised from headers or page', () => {
  const headers = (values: Readonly<Record<string, string>>) => ({ get: (name: string) => values[name] ?? null });
  assert.equal(isChallenge(headers({ 'cf-mitigated': 'challenge' }), ''), true);
  assert.equal(isChallenge(headers({}), '<html><head><title>Client Challenge</title>'), true);
  assert.equal(isChallenge(headers({}), '<html><head><title>Radware Bot Manager Captcha</title>'), true);
  assert.equal(isChallenge(headers({}), '<html><head><title>The temporal variability of Io’s hotspots</title>'), false);
  // A full article that embeds Cloudflare's bot-management script (Nature does) is not a challenge page.
  const article = `<html><head><title>Ammonium-rich bright areas on Ceres</title><script src="/cdn-cgi/challenge-platform/scripts/jsd/main.js"></script></head><body>${'<p>text</p>'.repeat(5000)}</body></html>`;
  assert.equal(isChallenge(headers({}), article), false);
  assert.equal(isChallenge(headers({}), '<html><body><div id="cf-chl-widget"></div></body></html>'), true);
});

test('the papers command takes targets, subject phrases, the full-text index, an instrument, a host, JSON and an output directory', () => {
  assert.deepEqual(parseCli(['papers', 'io', '--instrument', 'JIRAM', '--json']), { command: 'papers', targets: ['io'], instrument: 'JIRAM', json: true, verbose: false });
  assert.deepEqual(parseCli(['papers', 'S301', '--host', 'Sgr A*']), { command: 'papers', targets: ['S301'], host: 'Sgr A*', json: false, verbose: false });
  assert.deepEqual(parseCli(['papers', 'm61', 'm82', '--about', 'Cepheid, red supergiant', '--fulltext']), { command: 'papers', targets: ['m61', 'm82'], about: ['Cepheid', 'red supergiant'], fulltext: true, json: false, verbose: false });
  assert.throws(() => parseCli(['papers', 'S301', 'S2', '--host', 'Sgr A*']), /--host applies to one OBJECT/u);
  assert.throws(() => parseCli(['papers']), /telescope papers OBJECT/u);
  assert.throws(() => parseCli(['papers', 'io', '--kind', 'cube']), /Unknown or repeated papers option/u);
});

test('papers that made the map outrank papers that only mention the target', () => {
  const made = { title: 'The temporal variability of Io’s hotspots', captions: [
    { kind: 'table' as const, label: 'Table 1', text: 'List of observations of the M and L band used for this study. Distance, Sub-Spacecraft Point (SSP) longitude…' },
    { kind: 'figure' as const, label: 'Figure 2', text: '(A) Cylindrical equirectangular maps of the band radiance in the M filter for the orbits 41, 43, 47, and 49.' }] };
  const cites = { title: 'JIRAM observations of Io’s volcanoes', captions: [{ kind: 'figure' as const, label: 'Figure 1', text: 'Spectra of three hot spots.' }] };
  assert.equal(evidenceScore(made, ['Io'], 'JIRAM'), 3 + 2 + 1);
  assert.equal(evidenceScore(cites, ['Io'], 'JIRAM'), 2 + 1);
  assert.equal(evidenceScore({ ...cites, sentences: ['Io has a hot spot.'] }, ['Io'], 'JIRAM'), 2 + 2 + 1, 'a sentence that names the subject counts');
});

test('a target is asked for by every spelling of its names, and a subject by its singular and plural', () => {
  assert.deepEqual(spellings(['M61', 'NGC 4303', '3C 273', 'Sgr A*', 'GN-z11', 'Io']), ['M 61', 'M61', 'NGC 4303', 'NGC4303', '3C 273', '3C273', 'Sgr A*', 'GN-z11', 'Io']);
  assert.deepEqual(forms(['Cepheid', 'red supergiant', 'Miras']), ['Cepheid', 'Cepheids', 'red supergiant', 'red supergiants', 'Miras']);
  const asked = new URL(openAlexQuery({ names: spellings(['M61', 'NGC 4303']), about: ['Cepheid'], fulltext: true, newestFirst: true })).searchParams;
  assert.equal(asked.get('filter'), 'fulltext.search:("M 61" OR "M61" OR "NGC 4303" OR "NGC4303") AND ("Cepheid" OR "Cepheids"),type:article|review|preprint|letter');
  assert.deepEqual([asked.get('sort'), asked.get('per-page'), asked.has('api_key')], ['publication_year:desc', '100', false]);
  assert.equal(new URL(arxivQuery({ names: spellings(['M61']), about: ['Cepheid'] })).searchParams.get('search_query'), '(all:"M 61" OR all:"M61") AND (all:"Cepheid" OR all:"Cepheids")');
  assert.equal(new URL(citingQuery(['https://openalex.org/W1', 'https://openalex.org/W2'])).searchParams.get('filter'), 'cites:W1|W2', 'a list with no search: a tenth of a search\'s cost');
  assert.deepEqual(['https://arxiv.org/pdf/2110.11376v2', 'http://arxiv.org/abs/astro-ph/0305259', 'https://doi.org/10.48550/arxiv.2110.11376', null].map(arxivIdOf), ['2110.11376', 'astro-ph/0305259', null, null]);
  assert.throws(() => openAlexQuery({ names: ['*'] }), /at least one name/u);
});

const article = `<html><body><article class="ltx_document"><p class="ltx_p">Many galaxies host Cepheids. We observed NGC 4303 with <i>HST</i>. Leonard et al. (2003) found 41 Cepheids in NGC 1637.</p>
  <p>The longest period among the Cepheids of NGC&nbsp;4303 is 68.17 d, with <math><mi>T</mi><annotation encoding="application/x-tex">T_{\rm eff}</annotation></math> near 5000 K.</p>
  <ul><li>Cepheids in NGC 4303, an entry of the reference list</li></ul></article></body></html>`;
const longest = 'The longest period among the Cepheids of NGC 4303 is 68.17 d, with T near 5000 K.';

test('the sentences that name the subject are quoted as printed, those that also name the target first', () => {
  const names = spellings(['NGC 4303']), cepheids = forms(['Cepheid']);
  assert.deepEqual(evidenceSentences(article, names, cepheids, false), [longest], 'in a paper about many galaxies, a sentence must name this one');
  assert.deepEqual(evidenceSentences(article, names, cepheids, true), [longest, 'Many galaxies host Cepheids.', 'Leonard et al. (2003) found 41 Cepheids in NGC 1637.'], 'an abbreviation does not end a sentence');
  assert.deepEqual(evidenceSentences(article, names, [], false), ['We observed NGC 4303 with HST.', longest], 'with no subject, the sentences that name the target');
  assert.deepEqual(evidenceSentences(article, names, cepheids, true, 1), [longest]);
  const unit = '<p>Its spectrum is that of a Cepheid of NGC 4303 at 5000 K. The next sentence is another.</p>';
  assert.deepEqual(evidenceSentences(unit, names, cepheids, false), ['Its spectrum is that of a Cepheid of NGC 4303 at 5000 K.'], 'a unit after a number ends its sentence; an initial does not');
  const captions = [{ kind: 'table' as const, label: 'Table 2', text: 'Table 2: The Cepheids of NGC 4303.' }, { kind: 'figure' as const, label: 'Figure 1', text: 'Map of the field.' }];
  assert.deepEqual([relevantCaptions(captions, cepheids).map(caption => caption.label), relevantCaptions(captions).map(caption => caption.label)], [['Table 2'], ['Figure 1']], 'a subject search quotes the captions that name the subject');
});

test('the other works under a paper\'s title are found by title: an erratum is printed that way', () => {
  const title = 'A bright early-type star in the halo of NGC 253: Runaway or in situ formation?';
  // Crossref's answer for this title on 2026-10-04, cut to the fields read, with a preprint record added.
  const crossref = { message: { items: [
    { DOI: '10.1051/0004-6361:20021909', title: [title], type: 'journal-article', issued: { 'date-parts': [[2003, 1]] } },
    { DOI: '10.1051/0004-6361:20030311', title: ['A bright early-type star in the halo of NGC 253:  Runaway or \nin situ formation?'], type: 'journal-article', issued: { 'date-parts': [[2003]] } },
    { DOI: '10.48550/arxiv.astro-ph/0000000', title: [title], type: 'posted-content', issued: { 'date-parts': [[2002]] } },
    { DOI: '10.1051/0004-6361:20000336', title: ['Possible star formation in the halo of NGC 253'], type: 'journal-article', issued: { 'date-parts': [[2001]] } }] } };
  assert.deepEqual(sameTitleWorks(crossref, { title, doi: 'https://doi.org/10.1051/0004-6361:20021909' }), [{ doi: 'https://doi.org/10.1051/0004-6361:20030311', year: 2003, type: 'journal-article', title }]);
  // The AAS journals quote the title in the erratum's own.
  const quoted = { message: { items: [{ DOI: '10.1086/344203', title: ['“The Distance to SN 1999em in NGC 1637 from the Expanding Photosphere Method” (ApJ, 566, L63 [2002])'], type: 'journal-article' }] } };
  assert.deepEqual(sameTitleWorks(quoted, { title: 'The Distance to SN 1999em in NGC 1637 from the Expanding Photosphere Method', doi: 'https://doi.org/10.1086/324785' }).map(work => [work.doi, work.year]), [['https://doi.org/10.1086/344203', null]]);
  assert.throws(() => sameTitleWorks({ message: {} }, { title, doi: null }), /items must be an array/u);
});

const galaxyWorkspace = async (): Promise<string> => {
  const workspace = await mkdtemp(resolve(tmpdir(), 'cssearth-papers-'));
  await mkdir(resolve(workspace, 'src/objects/m61'), { recursive: true });
  await writeFile(resolve(workspace, 'src/objects/m61/object.json'), await readFile(resolve(WORKSPACE, 'src/objects/m61/object.json')));
  return workspace;
};
const indexed = (id: string, title: string, abstract: string, more: Readonly<Record<string, unknown>> = {}) => ({ id: `https://openalex.org/${id}`, doi: `https://doi.org/10.0000/${id}`, title, publication_year: 2026,
  type: 'article', open_access: { is_oa: false, oa_url: null }, abstract_inverted_index: Object.fromEntries(abstract.split(' ').map((word, index) => [`${word}#${index}`, [index]]).map(([key, at]) => [String(key).split('#')[0], at])), ...more });

test('a subject search quotes the text, and lists the erratum, the retraction and the later works of each paper', async () => {
  const calls: { readonly url: string; readonly key: string | null }[] = [], workspace = await galaxyWorkspace();
  const cepheids = indexed('W10', 'Cepheids in M61 and M77', 'Periods of stars in NGC4303', { open_access: { is_oa: true, oa_url: 'https://publisher.example/W10/pdf' },
    locations: [{ landing_page_url: 'https://publisher.example/W10', pdf_url: 'https://publisher.example/W10/pdf' }, { landing_page_url: 'http://arxiv.org/abs/2601.00001', pdf_url: null }] });
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input); calls.push({ url, key: new Headers(init?.headers).get('authorization') });
    if (url.startsWith('https://api.openalex.org/') && url.includes('cites')) return Response.json({ meta: { count: 140 }, results: [
      indexed('W20', 'M61 revisited', 'The Cepheids again', { referenced_works: ['https://openalex.org/W10'] }), indexed('W22', 'M61 Revisited', 'The same work under a second DOI', { referenced_works: ['https://openalex.org/W10'] }), indexed('W21', 'Another galaxy', 'It cites the paper', { referenced_works: ['https://openalex.org/W10'] })] });
    if (url.startsWith('https://api.openalex.org/')) return Response.json({ results: [indexed('W11', 'A withdrawn survey of Messier 61', 'It found one Cepheid', { is_retracted: true }), cepheids,
      indexed('W12', 'Cepheids of another galaxy', 'M 6 is a cluster')] }, { headers: { 'x-ratelimit-remaining': '990', 'x-ratelimit-limit': '1000' } });
    if (url.startsWith('https://api.crossref.org/')) return Response.json({ message: { items: url.includes('withdrawn') ? [] : [
      { DOI: '10.0000/w10', title: ['Cepheids in M61 and M77'], type: 'journal-article' }, { DOI: '10.0000/w10e', title: ['Erratum: “Cepheids in M61 and M77”'], type: 'journal-article', issued: { 'date-parts': [[2027]] } }] } });
    if (url.startsWith(AR5IV_HTML)) return new Response(article, { headers: { 'content-type': 'text/html' } });
    return new Response('%PDF', { headers: { 'content-type': 'application/pdf' } });
  };
  const result = await searchPapers(workspace, { target: 'm61', about: ['Cepheid'], fetcher, pause: async () => undefined, apiKey: 'secret' });
  await rm(workspace, { recursive: true, force: true });
  assert.deepEqual(result.names, ['M 61', 'M61', 'Messier 61', 'Messier61', 'NGC 4303', 'NGC4303', 'PGC 40001', 'PGC40001']);
  assert.deepEqual([result.about, result.candidates, result.budget], [['Cepheid'], 2, { remaining: 990, limit: 1000 }], 'a work that names neither spelling is dropped');
  assert.deepEqual(result.issues, ['Later works: the newest 100 of the 140 works that cite these were read.']);
  // The published copy is a PDF, so the arXiv preprint is read; the withdrawn paper has no open copy and costs no request.
  assert.deepEqual(calls.map(call => call.url.split('?')[0]), ['https://api.openalex.org/works', 'https://publisher.example/W10/pdf', `${AR5IV_HTML}/2601.00001`, 'https://api.openalex.org/works', 'https://api.crossref.org/works', 'https://api.crossref.org/works']);
  assert.deepEqual(calls.map(call => call.key), ['Bearer secret', null, null, 'Bearer secret', null, null], 'the key goes to OpenAlex alone, as a header');
  assert.equal(JSON.stringify(result).includes('secret'), false);
  const [first, second] = result.works;
  assert.deepEqual([first!.title, first!.sentences, first!.evidence], ['Cepheids in M61 and M77', [longest, 'Many galaxies host Cepheids.', 'Leonard et al. (2003) found 41 Cepheids in NGC 1637.'], 2 * 3 + 1]);
  assert.equal(first!.access.reason, 'arXiv preprint 2601.00001 read as HTML (ar5iv); the published text may differ');
  assert.deepEqual(first!.sameTitle, [{ doi: 'https://doi.org/10.0000/w10e', year: 2027, type: 'journal-article', title: 'Erratum: “Cepheids in M61 and M77”' }]);
  assert.deepEqual([first!.later, first!.laterCount], [[{ year: 2026, title: 'M61 revisited', doi: 'https://doi.org/10.0000/W20' }], 1], 'a citing work that does not name the galaxy is left out, and one held twice is named once');
  assert.deepEqual([second!.title, second!.retracted, second!.access.status, second!.sameTitle, second!.later], ['A withdrawn survey of Messier 61', true, 'closed', undefined, undefined]);
  const text = formatPapers(result);
  assert.match(text, /^M61 · about Cepheid · 2 of 2 matching openalex works · 6 requests\nOpenAlex credits left today: 990 of 1000; a search costs 10\.\nLater works: the newest 100 of the 140 works that cite these were read\.\n/u);
  assert.match(text, /\n {3}“The longest period among the Cepheids of NGC 4303 is 68\.17 d, with T near 5000 K\.”\n/u);
  assert.match(text, /\n {3}Also published under this title: https:\/\/doi\.org\/10\.0000\/w10e \(2027, journal-article\)\. An erratum is printed this way: read it before using the numbers\.\n {3}Later works that cite it and name M61: 1\n {5}2026 {2}M61 revisited {2}https:\/\/doi\.org\/10\.0000\/W20\n/u);
  assert.match(text, /\n {3}RETRACTED, by the index's record: do not use its results\.\n/u);
});

test('a sweep asks once for each target, and asks arXiv for the rest once OpenAlex says its budget is spent', async () => {
  const calls: string[] = [], pauses: number[] = [], workspace = await galaxyWorkspace();
  const feed = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><id>http://arxiv.org/abs/2609.00002v1</id><title>Red supergiants of NGC 9998</title>
    <summary>Spectra of three stars.</summary><published>2026-09-02T00:00:00Z</published></entry></feed>`;
  const fetcher: typeof fetch = async input => {
    const url = String(input); calls.push(new URL(url).host);
    if (url.startsWith('https://export.arxiv.org/')) return new Response(url.includes('9998') ? feed : '<feed xmlns="http://www.w3.org/2005/Atom"></feed>');
    if (calls.length === 1) return Response.json({ results: [indexed('W30', 'The red supergiants of NGC 4303', 'Spectra'), indexed('W31', 'A census of M61', 'It has a red supergiant')] });
    return Response.json({ error: 'Rate limit exceeded', message: 'Insufficient budget.', retryAfter: 26_685 }, { status: 429 });
  };
  const result = await sweepPapers(workspace, { targets: ['m61', 'NGC 9999', 'NGC 9998'], about: ['red supergiant'], fulltext: true, fetcher, pause: async ms => { pauses.push(ms); }, apiKey: '' });
  await rm(workspace, { recursive: true, force: true });
  assert.deepEqual(calls, ['api.openalex.org', 'api.openalex.org', 'export.arxiv.org', 'export.arxiv.org'], 'a refusal holds until midnight UTC: OpenAlex is not asked again');
  // The waits are what is left of each gap after the time the run took, so they are bounded, not exact.
  assert.deepEqual([pauses.length, pauses[0]! > 0 && pauses[0]! <= 1000, pauses[1]! > 1000 && pauses[1]! <= 3000], [2, true, true], 'requests to one host are a second apart, and three for the arXiv API');
  const issue = 'OpenAlex returned HTTP 429: the daily budget of this network, shared by everyone on it without an API key, is spent and returns in 7 h 25 min; a free key in OPENALEX_API_KEY has ten times the budget.';
  assert.deepEqual(result.targets.map(entry => [entry.target.name, entry.source, entry.sourceIssue, entry.candidates, entry.works.map(work => work.title)]), [
    ['M61', 'openalex', undefined, 2, ['The red supergiants of NGC 4303', 'A census of M61']], ['NGC 9999', 'arxiv', issue, 0, []], ['NGC 9998', 'arxiv', issue, 1, ['Red supergiants of NGC 9998']]]);
  assert.equal(result.requests, 4);
  const text = formatSweep(result);
  assert.match(text, /^3 targets · about red supergiant · full text · 4 requests\nOpenAlex unavailable: OpenAlex returned HTTP 429: [^\n]+ Targets marked arXiv were searched there, by title and abstract\.\n\nM61 · 2 works\n {2}2026 {2}The red supergiants of NGC 4303 {2}https:\/\/doi\.org\/10\.0000\/W30\n/u);
  assert.match(text, /\nNGC 9999 \(arXiv\) · no work names it\n\nNGC 9998 \(arXiv\) · 1 work\n {2}2026 {2}Red supergiants of NGC 9998\n$/u);
});
