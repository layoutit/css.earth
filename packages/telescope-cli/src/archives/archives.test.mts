import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { WORKSPACE } from '@cssearth/telescope/node';
import { ADAPTERS } from '../query-modes.mts';
import { SERVICES } from '../vo/discovery.mts';
import { ARCHIVES } from './archives.mts';

test('the archive list names each archive once, and its ledgers, searches and VO profiles are the ones the telescope has', () => {
  const ids = ARCHIVES.map(archive => archive.id);
  assert.equal(new Set(ids).size, ids.length);
  // An archive with a ledger has a coverage reader of the same id, and no reader is left without its archive.
  assert.deepEqual(ARCHIVES.filter(archive => archive.ledgerCommand).map(archive => archive.id).sort(), Object.keys(ADAPTERS).sort());
  for (const archive of ARCHIVES) if (archive.ledgerCommand) assert.ok(existsSync(resolve(WORKSPACE, archive.ledgerCommand)), `${archive.id}: ${archive.ledgerCommand}`);
  assert.deepEqual(ARCHIVES.filter(archive => archive.search).map(archive => archive.id), ['keck', 'gemini', 'chandra', 'spitzer']);
  // Every VO profile is the registry entry of an archive here, at the profile's own address.
  for (const service of SERVICES) assert.ok(ARCHIVES.some(archive => archive.registry?.ivoid === service.authority && archive.registry.address === service.service), service.authority);
});
