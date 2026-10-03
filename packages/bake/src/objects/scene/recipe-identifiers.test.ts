import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { requireRecord } from '@cssearth/core';
import { BANDED_ELLIPSOID_SCHEMA, LAYERED_OBLATE_SCHEMA, SHAPE_MODEL_SCHEMA } from './recipe-identifiers.ts';
import { VOLUME_PROVENANCE_SCHEMA } from '../../volume/index.ts';

const root = new URL('../../../../../', import.meta.url);
test('bake routing and provenance identifiers preserve authored record bytes', () => {
  for (const [path, schema] of [
    ['jupiter/source/preparation/geometry.json', BANDED_ELLIPSOID_SCHEMA],
    ['saturn/source/preparation/geometry.json', LAYERED_OBLATE_SCHEMA],
    ['haumea/source/preparation/shape-model.json', SHAPE_MODEL_SCHEMA],
    ['betelgeuse-shell/source/provenance.json', VOLUME_PROVENANCE_SCHEMA],
    ['beta-pictoris-disc/source/provenance.json', VOLUME_PROVENANCE_SCHEMA],
  ]) {
    const record = requireRecord(JSON.parse(readFileSync(new URL(`src/objects/${path}`, root), 'utf8')));
    assert.equal(record.schema, schema, path);
  }
});
