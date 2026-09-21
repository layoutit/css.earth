import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CAPTION_LIMIT, abstractText, extractCaptions, isChallenge, mentions, openAlexQuery, parseOpenAlexResponse, rankWorks, relevantCaptions } from './papers.mts';
import { parseCli } from './cli.mts';

const fixtures = resolve(import.meta.dirname, '../../../tests/fixtures/telescope-papers');
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
  assert.deepEqual(rankWorks(works).map(work => work.id), ['https://openalex.org/W4', 'https://openalex.org/W2', 'https://openalex.org/W3', 'https://openalex.org/W1']);
  assert.equal(rankWorks(works, 2).length, 2);
});

test('the OpenAlex query searches title and abstract of papers only', () => {
  const url = new URL(openAlexQuery('Io', 'JIRAM'));
  assert.equal(url.searchParams.get('filter'), 'title_and_abstract.search:Io JIRAM,type:article|review|preprint|letter');
  assert.equal(url.searchParams.has('mailto'), false);
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
});

test('the papers command takes one target and optional instrument, JSON and output directory', () => {
  assert.deepEqual(parseCli(['papers', 'io', '--instrument', 'JIRAM', '--json']), { command: 'papers', target: 'io', instrument: 'JIRAM', json: true, verbose: false });
  assert.throws(() => parseCli(['papers']), /telescope papers OBJECT/u);
  assert.throws(() => parseCli(['papers', 'io', '--kind', 'cube']), /Unknown or repeated papers option/u);
});
