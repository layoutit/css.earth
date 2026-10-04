import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { jwstAcquisition } from './jwst-acquisition.mts';

test('recomputed acquisitions preserve every committed JWST band for both discs', () => {
  for (const [id, count] of [['beta-pictoris-disc', 2], ['hd-181327-disc', 6]] as const) {
    const manifest: unknown = JSON.parse(readFileSync(new URL(`../../../../src/objects/${id}/source/manifest.json`, import.meta.url), 'utf8'));
    let checked = 0;
    for (const input of requireArray(requireRecord(manifest).inputs)) {
      const row = requireRecord(input);
      if (typeof row.acquisition !== 'string') continue;
      const match = row.acquisition.match(/by its URI (\S+).*\/jwst\/imaging\/programs\/([^/]+)\.json\./u);
      if (!match) continue;
      assert.equal(jwstAcquisition(requireString(match[2]), requireString(match[1]), manifest), row.acquisition);
      checked++;
    }
    assert.equal(checked, count, id);
  }
});
test('new records and programs use the current root, historical allowance is program-specific', () => {
  const current = jwstAcquisition('new-1', 'mast:file', undefined);
  assert.ok(current.includes('/jwst/programs/new-1.json'));
  const historical = { inputs: [{ acquisition: "old packages/telescope-cli/src/archives/jwst/imaging/programs/old-1.json." }] };
  assert.equal(jwstAcquisition('new-1', 'mast:file', historical), current);
  assert.ok(jwstAcquisition('old-1', 'mast:file', historical).includes('/imaging/programs/old-1.json'));
});
