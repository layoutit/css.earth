import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
// The lab runner mirrors source paths under its compiled directory.
const moduleUrl = import.meta.url.replace('/.local/nebula-lab/compiled/', '/');
const source = (path: string) => readFileSync(new URL(path, moduleUrl), 'utf8');

test('catalogue projection uses shared coordinate admission and reads once', () => {
  const caller = source('./observed-catalogue.ts');
  assert.match(caller, /isStellarCoordinate\(centerIcrsDegrees/u);
  assert.doesNotMatch(caller, /const coordinate|readObservedStellarCatalogueEnvelope/u);
  assert.equal(caller.match(/parseObservedStellarCatalogue\(/gu)?.length, 1);
});
