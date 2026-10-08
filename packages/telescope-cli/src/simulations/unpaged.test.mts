/** Planets with no page that a title says have a phase curve or a map (unpaged.mts), offline. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { nameKey, parseArchivePlanets, searchUnpaged, titleQuery, unpagedPlanets } from './unpaged.mts';

const csv = 'pl_name,hostname\n"KELT-1 b","KELT-1"\nWASP-18 b,WASP-18\nWASP-100 b,WASP-100\nKepler-22 b,Kepler-22\n';
const papers = [{ year: 2019, title: 'Spitzer Phase Curves of KELT-1b and the Signatures of Nightside Clouds', url: 'https://doi.org/10.48550/arxiv.1808.09575' },
  { year: 2020, title: 'A phase curve of WASP-18b', url: 'https://doi.org/10.0/a' }, { year: 2021, title: 'TESS phase curve of KELT-1 b', url: 'https://doi.org/10.0/b' },
  { year: 2022, title: 'Phase curves of asteroids', url: 'https://doi.org/10.0/c' }];

test('the archive\'s table is read as planets, and anything else is refused by its first line', () => {
  assert.deepEqual(parseArchivePlanets(csv).slice(0, 2), [{ name: 'KELT-1 b', host: 'KELT-1' }, { name: 'WASP-18 b', host: 'WASP-18' }]);
  assert.throws(() => parseArchivePlanets('<html>busy</html>'), /not a pl_name,hostname table/u);
});

test('a planet is unpaged when no page carries its name, spaces and hyphens aside; its titles are listed, the newest first', () => {
  assert.equal(nameKey('WASP-18 b'), nameKey('wasp18b'));
  const found = unpagedPlanets(parseArchivePlanets(csv), ['WASP-18b', 'KELT-1'], papers);
  // WASP-18 b has a page, WASP-100 b and Kepler-22 b no title: only KELT-1 b is left, and its star has a page.
  assert.deepEqual(found, [{ name: 'KELT-1 b', host: 'KELT-1', hostPaged: true, papers: [papers[2], papers[0]] }]);
});

test('both sources are asked in bulk: the archive once, then DataCite\'s arXiv titles page by page', async () => {
  const asked: string[] = [], waits: number[] = [];
  const page = (number: number) => ({ data: [{ attributes: { doi: `10.48550/arXiv.${number}`, publicationYear: 2019, titles: [{ title: number === 1 ? papers[0]!.title : 'A phase curve of WASP-100b' }], descriptions: [] } }], meta: { totalPages: 2 } });
  const fetcher = (async (url: unknown) => { asked.push(String(url)); return new Response(String(url).includes('exoplanetarchive') ? csv : JSON.stringify(page(asked.length - 1)), { status: 200 }); }) as typeof fetch;
  const { planets, requests } = await searchUnpaged(['WASP-18 b', 'KELT-1'], { fetcher, wait: async ms => { waits.push(ms); } });
  assert.equal(requests, 3);
  assert.equal(new URL(asked[0]!).searchParams.get('query'), 'select pl_name,hostname from pscomppars');
  assert.equal(asked[1], titleQuery(1));
  assert.match(new URL(asked[2]!).searchParams.get('query')!, /^titles\.title:\("phase curve" OR "phase curves" OR .*"longitudinal map"\)$/u);
  assert.deepEqual(waits, [400, 400]);
  assert.deepEqual(planets.map(planet => [planet.name, planet.hostPaged, planet.papers.length]), [['KELT-1 b', true, 1], ['WASP-100 b', false, 1]]);
  await assert.rejects(searchUnpaged([], { fetcher: (async () => new Response('', { status: 503 })) as typeof fetch, wait: async () => {} }), /HTTP 503 from exoplanetarchive\.ipac\.caltech\.edu/u);
});
