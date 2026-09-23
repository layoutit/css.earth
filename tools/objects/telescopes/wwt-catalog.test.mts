import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { explorationAnswer } from './exploration.mts';
import { loadWwtImagery, matchWwtImagery, parseWwtCatalog, parseWwtCatalogLines } from './wwt-catalog.mts';

const catalog = parseWwtCatalogLines(await readFile(resolve('data/wwt/core-imagesets.jsonl'), 'utf8'));

test('pinned WWT index preserves generic imageset metadata, source revision and credits', () => {
  assert.equal(catalog.imagesets.length, 4169);
  assert.equal(catalog.source.inputs.length, 45);
  const europa = matchWwtImagery(catalog, { id: 'europa', name: 'Europa', aliases: [] });
  assert.equal(europa.state, 'indexed');
  if (europa.state !== 'indexed') return;
  assert.equal(europa.total, 1);
  assert.equal(europa.matches[0]?.matchBasis, 'reference-frame');
  assert.equal(europa.matches[0]?.projection, 'Toast');
  assert.equal(europa.matches[0]?.position.tileLevels, 5);
  assert.match(europa.matches[0]?.credits ?? '', /NASA\/JPL\/Space Science Institute/u);
  assert.match(europa.matches[0]?.catalogUrl ?? '', /planet_europa_visible\.xml$/u);
  assert.ok(europa.matches[0]?.urlTemplate.includes('{Q}'));
});

test('title matching is generic, bounded and does not confuse a planet name with its host star', () => {
  const nebula = matchWwtImagery(catalog, { id: 'm42', name: 'Orion Nebula', aliases: ['M42', 'NGC 1976'] });
  assert.equal(nebula.state, 'indexed');
  if (nebula.state !== 'indexed') return;
  assert.ok(nebula.total > nebula.matches.length);
  assert.equal(nebula.matches.length, nebula.limit);
  assert.ok(nebula.matches.every(image => image.matchBasis === 'title'));
  assert.ok(nebula.matches.some(image => image.position.centerXDegrees > 0 && image.position.centerYDegrees < 0));
  const star = matchWwtImagery(catalog, { id: 'hr-8799', name: 'HR 8799', aliases: [] });
  assert.equal(star.state, 'indexed');
  if (star.state === 'indexed') assert.equal(star.total, 0); // WWT's HR 8799e title is a different identity.
});

test('curated imagery stays outside numbered observations and scientific search coverage', () => {
  const curatedImagery = matchWwtImagery(catalog, { id: 'europa', name: 'Europa', aliases: [] });
  const answer = explorationAnswer({ target: 'europa' }, { ledgers: [], capabilities: [], targetCatalogue: [{ id: 'europa', name: 'Europa', aliases: [] }],
    targetAssociations: [], bodyMaps: [], curatedImagery });
  assert.deepEqual(answer.choices, []);
  assert.deepEqual(answer.outcome, { selection: 'none', coverage: 'bounded' });
  assert.equal(answer.curatedImagery, curatedImagery);
});

test('malformed and missing indexes fail visibly without breaking observation discovery', async () => {
  assert.throws(() => parseWwtCatalog({ ...catalog, schema: 'unknown' }), /source or schema/u);
  const missing = await loadWwtImagery('/no-such-checkout', { id: 'europa', name: 'Europa', aliases: [] });
  assert.equal(missing.state, 'unavailable');
  if (missing.state === 'unavailable') assert.match(missing.reason, /missing/u);
});
