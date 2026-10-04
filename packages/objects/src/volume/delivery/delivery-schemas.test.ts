/** Pin shared handoff identifiers to the retained records existing writers and readers exchange. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { requireRecord } from '@cssearth/core';
import { VOLUME_DATASET_MANIFEST_SCHEMA, COMPACT_DENSITY_DELIVERY_SCHEMA, NEBULA_DEPTH_MODEL_SCHEMA,
  GAIA_NEBULA_FIELD_SCHEMA, NEBULA_DELIVERY_SCHEMA, CIRCUMSTELLAR_RECONSTRUCTION_SCHEMA } from '../../index.ts';

const records = [
  [VOLUME_DATASET_MANIFEST_SCHEMA, 'cssearth-volume-dataset-manifest@1', 'src/objects/lmc-volume/source/lens-manifest.json'],
  [COMPACT_DENSITY_DELIVERY_SCHEMA, 'cssearth-compact-density-delivery@1', 'src/objects/lmc-volume/source/compact-delivery.json'],
  [NEBULA_DEPTH_MODEL_SCHEMA, 'cssearth-nebula-depth-model@1', 'labs/nebula/models/m42/depth-model.json'],
  [GAIA_NEBULA_FIELD_SCHEMA, 'cssearth-gaia-nebula-field@1', 'src/objects/m42-volume/source/stellar-field.json'],
  [NEBULA_DELIVERY_SCHEMA, 'cssearth-nebula-delivery@2', 'src/objects/beta-pictoris-disc/source/delivery.json'],
  [CIRCUMSTELLAR_RECONSTRUCTION_SCHEMA, 'cssearth-circumstellar-reconstruction@2', 'src/objects/beta-pictoris-disc/source/reconstruction-color.json'],
] as const;

for (const [schema, historical, path] of records) {
  test(`${schema} preserves the retained wire spelling`, () => {
    assert.equal(schema, historical);
    const record = requireRecord(JSON.parse(readFileSync(new URL(`../../../../../${path}`, import.meta.url), 'utf8')));
    assert.equal(record.schema, schema);
  });
}
